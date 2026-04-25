# Ocufi 邀请系统后端 PR 文本(贴到 ocufi-api)

## 任务

实现邀请绑定 + 激活检查 + 积分 10% 自动分成。前端契约已固定:
- 邀请码 = 钱包地址 SHA-256 前 30 bit → 6 字符 base32(Crockford,字母表 `abcdefghjkmnpqrstvwxyz0123456789`)
- 同钱包永远同码,**后端不存 inviter_code 字段**(用 inviter_address 反推)
- 激活门槛:被邀请人单笔交易折算 USD ≥ 100

---

## 1. SQL Migration(Alembic)

新建文件 `alembic/versions/xxxx_add_invite_relation.py`

```python
"""add invite relation

Revision ID: xxxx
Revises: <最近一个 revision id>
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa


revision = 'xxxx'
down_revision = '<填上一个 revision id>'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'invite_relation',
        sa.Column('id', sa.BigInteger, primary_key=True, autoincrement=True),
        # 被邀请人钱包(unique:一个钱包只能被邀请一次,永久绑定)
        sa.Column('invitee_address', sa.String(64), nullable=False, unique=True, index=True),
        # 邀请人钱包(可有多个 invitee 指向同一 inviter)
        sa.Column('inviter_address', sa.String(64), nullable=False, index=True),
        # 首次绑定时间
        sa.Column('bound_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        # 激活时间(invitee 单笔 ≥ 100U 时填,NULL 表示未激活)
        sa.Column('activated_at', sa.DateTime(timezone=True), nullable=True),
        # 累计给 inviter 分成的积分(每笔 invitee 交易后 +10%)
        sa.Column('total_earned_points', sa.BigInteger, nullable=False, server_default='0'),
    )
    # 排行榜按 inviter_address 聚合,这里加索引帮 GROUP BY
    op.create_index('ix_invite_inviter_activated', 'invite_relation', ['inviter_address', 'activated_at'])


def downgrade() -> None:
    op.drop_index('ix_invite_inviter_activated', table_name='invite_relation')
    op.drop_table('invite_relation')
```

跑 migration:`alembic upgrade head`

---

## 2. SQLAlchemy Model

新建 `app/models/invite.py`

```python
from datetime import datetime
from sqlalchemy import BigInteger, Column, DateTime, String
from sqlalchemy.sql import func

from app.core.database import Base


class InviteRelation(Base):
    __tablename__ = 'invite_relation'

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    invitee_address = Column(String(64), unique=True, nullable=False, index=True)
    inviter_address = Column(String(64), nullable=False, index=True)
    bound_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    activated_at = Column(DateTime(timezone=True), nullable=True)
    total_earned_points = Column(BigInteger, nullable=False, default=0)
```

记得在 `app/models/__init__.py` 加 `from .invite import InviteRelation`。

---

## 3. 邀请码工具(后端版)

新建 `app/services/invite_code.py`

```python
"""
邀请码 = 钱包地址 SHA-256 前 30 bit → 6 字符 base32(Crockford 风格)

字母表:abcdefghjkmnpqrstvwxyz0123456789(去掉 i/l/o/u 易混)

同钱包永远生成同一邀请码,前端可算可对账。
后端用途:
  1. 反推邀请码 → 邀请人地址(枚举所有候选人不现实,前端会传 inviter_address)
  2. 校验前端传来的 inviter_code 是否真的对应 inviter_address(防伪造)
"""
import hashlib

ALPHABET = 'abcdefghjkmnpqrstvwxyz0123456789'  # 32 char


def code_for(wallet_address: str) -> str:
    if not wallet_address:
        return ''
    digest = hashlib.sha256(wallet_address.encode()).digest()
    # 前 4 byte 拼成 30 bit
    v = (
        (digest[0] << 22) |
        (digest[1] << 14) |
        (digest[2] << 6) |
        (digest[3] >> 2)
    )
    out = ''
    for i in range(5, -1, -1):
        out += ALPHABET[(v >> (5 * i)) & 0x1f]
    return out


def is_valid_code(code: str) -> bool:
    if not isinstance(code, str) or len(code) != 6:
        return False
    return all(c in ALPHABET for c in code.lower())
```

---

## 4. FastAPI 路由

新建 `app/api/invite.py`

```python
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.invite import InviteRelation
from app.services.invite_code import code_for, is_valid_code

router = APIRouter(prefix='/invite', tags=['invite'])


class BindRequest(BaseModel):
    inviter_code: str = Field(..., min_length=6, max_length=6)
    inviter_address: str = Field(..., min_length=32, max_length=64)
    invitee_address: str = Field(..., min_length=32, max_length=64)


class BindResponse(BaseModel):
    bound: bool
    reason: str | None = None


@router.post('/bind', response_model=BindResponse)
async def bind(req: BindRequest, db: AsyncSession = Depends(get_db)):
    """
    绑定邀请关系(永久,不可改)
    校验:
      1. inviter_code 校验码格式
      2. inviter_code 与 inviter_address 一致(防伪造别人推荐)
      3. inviter ≠ invitee(自己不能邀自己)
      4. invitee 之前没被邀请过(unique 约束兜底)
    """
    if not is_valid_code(req.inviter_code):
        return BindResponse(bound=False, reason='invalid_code')

    expected_code = code_for(req.inviter_address)
    if expected_code != req.inviter_code.lower():
        return BindResponse(bound=False, reason='code_mismatch')

    if req.inviter_address == req.invitee_address:
        return BindResponse(bound=False, reason='self_invite')

    # 已存在则直接 success(幂等)
    existing = await db.scalar(
        select(InviteRelation).where(InviteRelation.invitee_address == req.invitee_address)
    )
    if existing:
        return BindResponse(bound=True, reason='already_bound')

    rel = InviteRelation(
        invitee_address=req.invitee_address,
        inviter_address=req.inviter_address,
    )
    db.add(rel)
    await db.commit()
    return BindResponse(bound=True)


class InviteeRow(BaseModel):
    address: str
    status: str       # 'pending' | 'activated'
    contributed_points: int
    joined_at: datetime


class MyInviteResponse(BaseModel):
    code: str
    invited_count: int
    activated_count: int
    earned_points: int
    invitees: list[InviteeRow]


@router.get('/me', response_model=MyInviteResponse)
async def me(address: str = Query(..., min_length=32, max_length=64), db: AsyncSession = Depends(get_db)):
    """我的邀请码 + 已邀请列表 + 累计统计"""
    code = code_for(address)

    rows = (await db.scalars(
        select(InviteRelation)
        .where(InviteRelation.inviter_address == address)
        .order_by(InviteRelation.bound_at.desc())
        .limit(200)
    )).all()

    activated = sum(1 for r in rows if r.activated_at is not None)
    earned = sum(r.total_earned_points for r in rows)

    return MyInviteResponse(
        code=code,
        invited_count=len(rows),
        activated_count=activated,
        earned_points=earned,
        invitees=[
            InviteeRow(
                address=r.invitee_address,
                status='activated' if r.activated_at else 'pending',
                contributed_points=r.total_earned_points,
                joined_at=r.bound_at,
            )
            for r in rows
        ],
    )


class LeaderRow(BaseModel):
    rank: int
    address: str   # 脱敏在前端做(后端给完整地址,方便排序时复用查询)
    activated: int
    points: int


@router.get('/leaderboard', response_model=list[LeaderRow])
async def leaderboard(db: AsyncSession = Depends(get_db)):
    """全站邀请 Top 10(按累计积分降序)"""
    stmt = (
        select(
            InviteRelation.inviter_address.label('addr'),
            func.count(InviteRelation.activated_at).label('activated'),
            func.sum(InviteRelation.total_earned_points).label('points'),
        )
        .group_by(InviteRelation.inviter_address)
        .order_by(func.sum(InviteRelation.total_earned_points).desc())
        .limit(10)
    )
    rows = (await db.execute(stmt)).all()
    return [
        LeaderRow(rank=i + 1, address=r.addr, activated=r.activated or 0, points=r.points or 0)
        for i, r in enumerate(rows)
    ]
```

记得在主 app 里 register router:

```python
# app/main.py
from app.api import invite
app.include_router(invite.router)
```

---

## 5. 改造 /points/claim · 加邀请分成

在原本的 `app/api/points.py`(或类似)的 claim 处理函数里,**积分入账后**追加:

```python
from app.models.invite import InviteRelation
from sqlalchemy import select, update

# ... 原本 claim 逻辑算出本笔积分 points_earned,验证完 tx ...

# === 新增:邀请激活 + 分成 ===
SOL_USD_THRESHOLD = 100  # 单笔 ≥ 100U 激活
INVITE_SHARE_BPS = 1000  # 10% (1000 / 10000)

# 1) 查这个钱包是否被邀请过
rel: InviteRelation | None = await db.scalar(
    select(InviteRelation).where(InviteRelation.invitee_address == claim.address)
)
if rel:
    # 2) 激活检查(本笔 USD 估值 ≥ 100,前端上报或后端算)
    tx_usd = claim.usd_value  # 假设 claim 请求里带上(或后端从 tx 解析)
    if rel.activated_at is None and tx_usd >= SOL_USD_THRESHOLD:
        rel.activated_at = datetime.now(timezone.utc)

    # 3) 已激活,给 inviter 加 10% 分成
    if rel.activated_at is not None:
        share = points_earned * INVITE_SHARE_BPS // 10000
        if share > 0:
            # 给 inviter 加积分(用现有 PointEvent 表插一条 source='invite_share')
            inviter_event = PointEvent(
                address=rel.inviter_address,
                points=share,
                tx_signature=f'{claim.tx_signature}:share',  # 复用 tx_sig + suffix 保唯一
                source='invite_share',
            )
            db.add(inviter_event)
            # 累计到 InviteRelation,方便 /invite/me 查
            rel.total_earned_points += share

    await db.commit()
```

**注意点**:
- `tx_signature` 在 PointEvent 表是 UNIQUE,用 `f'{tx_sig}:share'` 后缀让分成事件和原事件共存
- `source='invite_share'` 字段如果没有,加一个枚举值
- 激活更新和分成发放在同一事务里,保证原子性

---

## 6. 前端契约 · 已对齐

前端调用方式(已在 ocufi-web 里就位,等后端 endpoint 上线):

```ts
// 连钱包成功 → 检查 localStorage 有 pendingRef → POST /invite/bind
const pendingRef = getPendingRef();
if (pendingRef && walletAddress) {
  // inviter_address 怎么算?前端只知 ref code,需要后端反查
  // 方案:前端把 ref 直接传后端,后端 SELECT inviter_address FROM invite_relation WHERE ...
  //       或后端遍历最近活跃地址算 code 对比(前者更直接,但需要建索引或新表;后者贵但简单)
  //
  // 推荐:前端不传 inviter_address,后端按需算/查;但要在 InviteRelation 之外建一个
  //       wallet_invite_code 表:address ↔ code 双向索引;首次连钱包时插一条
}
```

**这部分需要你和我确认**:
- 简单方案 A:每次 `/invite/me?address=X` 时 upsert 一条 wallet_invite_code(address, code) — 让 code → address 反查可行
- 简单方案 B:`/invite/bind` 只要前端传 inviter_address(直接连体内的 ref 信息靠前端 lookup,需要先有「输入 ref 显示 inviter wallet」的 UI 让用户确认)

我倾向方案 A:加一个轻量映射表。让你的后端实现里:
- 用户首次访问 `/invite/me` 自动 upsert 自己的 (address, code)
- `/invite/bind` 接受 inviter_code,后端 SELECT address FROM wallet_invite_code WHERE code = inviter_code,找不到则报 'inviter_not_found'

```python
# 加另一张表
class WalletInviteCode(Base):
    __tablename__ = 'wallet_invite_code'
    address = Column(String(64), primary_key=True)
    code = Column(String(6), unique=True, nullable=False, index=True)
```

`/invite/me` 处理函数顶部:

```python
existing_code = await db.scalar(
    select(WalletInviteCode).where(WalletInviteCode.address == address)
)
if not existing_code:
    db.add(WalletInviteCode(address=address, code=code))
    await db.commit()
```

`/invite/bind` 改成只收 `inviter_code`,后端反查 inviter_address:

```python
class BindRequest(BaseModel):
    inviter_code: str
    invitee_address: str

@router.post('/bind')
async def bind(req: BindRequest, db: AsyncSession = Depends(get_db)):
    if not is_valid_code(req.inviter_code):
        return BindResponse(bound=False, reason='invalid_code')

    inviter = await db.scalar(
        select(WalletInviteCode).where(WalletInviteCode.code == req.inviter_code.lower())
    )
    if not inviter:
        return BindResponse(bound=False, reason='inviter_not_found')

    if inviter.address == req.invitee_address:
        return BindResponse(bound=False, reason='self_invite')

    # ... 同前
```

---

## 7. 测试用例(pytest)

```python
# tests/test_invite.py
import pytest
from app.services.invite_code import code_for, is_valid_code


def test_code_deterministic():
    addr = 'AVmAj5QEEcfA1234567890abcdef'
    assert code_for(addr) == code_for(addr)  # same wallet → same code
    assert is_valid_code(code_for(addr))


def test_code_distinct():
    a = code_for('addr_a' + '0' * 30)
    b = code_for('addr_b' + '0' * 30)
    assert a != b


@pytest.mark.asyncio
async def test_bind_self_rejected(client, sample_addr):
    code = code_for(sample_addr)
    r = await client.post('/invite/bind', json={
        'inviter_code': code,
        'invitee_address': sample_addr,
    })
    assert r.json()['bound'] is False
    assert r.json()['reason'] == 'self_invite'


@pytest.mark.asyncio
async def test_bind_idempotent(client, addr_a, addr_b):
    code_a = code_for(addr_a)
    # 先调用 me 触发 wallet_invite_code 写入
    await client.get(f'/invite/me?address={addr_a}')
    r1 = await client.post('/invite/bind', json={
        'inviter_code': code_a, 'invitee_address': addr_b,
    })
    r2 = await client.post('/invite/bind', json={
        'inviter_code': code_a, 'invitee_address': addr_b,
    })
    assert r1.json()['bound'] is True
    assert r2.json()['bound'] is True
    assert r2.json()['reason'] == 'already_bound'
```

---

## 部署 checklist

1. ✅ 跑 `alembic upgrade head` 建表
2. ✅ 重启 FastAPI(Railway 自动 redeploy)
3. ✅ 测试三个 endpoint:
   - `GET /invite/me?address=YOUR_WALLET` → 返回你的 code
   - `POST /invite/bind` 用 invalid code 应该返回 `invalid_code`
   - `GET /invite/leaderboard` → `[]`
4. ✅ 通知前端:可以把 `useInviteBind` 里的 mock 改成真调用

---

完了。有问题贴报错过来。
