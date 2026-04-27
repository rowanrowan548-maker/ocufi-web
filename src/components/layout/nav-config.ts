/**
 * T-908a · 顶部菜单结构(桌面 dropdown + 移动抽屉折叠共用)
 */

export interface NavLeaf {
  href: string;
  /** i18n key under nav.* */
  labelKey: string;
  /** 占位项(灰显 + Coming Soon 角标) */
  placeholder?: boolean;
}

export interface NavGroup {
  type: 'group';
  /** i18n key under nav.* */
  labelKey: string;
  items: NavLeaf[];
}

export interface NavLink {
  type: 'link';
  href: string;
  labelKey: string;
}

export type NavEntry = NavGroup | NavLink;

export const NAV_ENTRIES: NavEntry[] = [
  { type: 'link', href: '/trade', labelKey: 'nav.trade' },
  {
    type: 'group',
    labelKey: 'nav.markets',
    items: [
      { href: '/markets/trending', labelKey: 'nav.trending', placeholder: true },
      { href: '/watchlist', labelKey: 'nav.watchlist' },
      { href: '/token', labelKey: 'nav.tokenCheck' },
    ],
  },
  {
    type: 'group',
    labelKey: 'nav.strategy',
    items: [
      { href: '/alerts', labelKey: 'nav.alerts' },
      { href: '/limit', labelKey: 'nav.limit' },
      { href: '/strategy/copy', labelKey: 'nav.copyTrade', placeholder: true },
      { href: '/strategy/radar', labelKey: 'nav.smartMoney', placeholder: true },
    ],
  },
  {
    type: 'group',
    labelKey: 'nav.assets',
    items: [
      { href: '/portfolio', labelKey: 'nav.portfolio' },
      { href: '/history', labelKey: 'nav.history' },
      { href: '/badges', labelKey: 'nav.badges' },
      { href: '/points', labelKey: 'nav.points' },
    ],
  },
  {
    type: 'group',
    labelKey: 'nav.more',
    items: [
      { href: '/invite', labelKey: 'nav.invite' },
      { href: '/docs', labelKey: 'nav.docs' },
      { href: '/faq', labelKey: 'nav.faq' },
      { href: '/status', labelKey: 'nav.status' },
      { href: '/legal', labelKey: 'nav.legal' },
    ],
  },
];
