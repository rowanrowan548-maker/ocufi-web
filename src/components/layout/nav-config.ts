/**
 * T-908a/T-910 · 顶部菜单结构(桌面 dropdown + 移动抽屉折叠共用)
 *
 * T-910 加 icon + descKey 字段(双行布局:主标题 + 副标题描述)
 */

export interface NavLeaf {
  href: string;
  /** i18n key under nav.* · 主标题 */
  labelKey: string;
  /** i18n key under nav.descriptions.* · 副标题(可选 · 占位项也带描述提示) */
  descKey?: string;
  /** Lucide icon 名称(动态查表 · PascalCase) */
  iconName?: string;
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
      {
        href: '/markets/trending',
        labelKey: 'nav.trending',
        descKey: 'nav.descriptions.trending',
        iconName: 'Flame',
        placeholder: true,
      },
      {
        href: '/watchlist',
        labelKey: 'nav.watchlist',
        descKey: 'nav.descriptions.watchlist',
        iconName: 'Star',
      },
      {
        href: '/token',
        labelKey: 'nav.tokenCheck',
        descKey: 'nav.descriptions.tokenCheck',
        iconName: 'ShieldCheck',
      },
    ],
  },
  {
    type: 'group',
    labelKey: 'nav.strategy',
    items: [
      {
        href: '/alerts',
        labelKey: 'nav.alerts',
        descKey: 'nav.descriptions.alerts',
        iconName: 'BellRing',
      },
      {
        href: '/strategy/copy',
        labelKey: 'nav.copyTrade',
        descKey: 'nav.descriptions.copyTrade',
        iconName: 'Users',
        placeholder: true,
      },
      {
        href: '/strategy/radar',
        labelKey: 'nav.smartMoney',
        descKey: 'nav.descriptions.smartMoney',
        iconName: 'Radar',
        placeholder: true,
      },
    ],
  },
  {
    type: 'group',
    labelKey: 'nav.assets',
    items: [
      {
        href: '/portfolio',
        labelKey: 'nav.portfolio',
        descKey: 'nav.descriptions.portfolio',
        iconName: 'Wallet',
      },
      {
        href: '/history',
        labelKey: 'nav.history',
        descKey: 'nav.descriptions.history',
        iconName: 'History',
      },
      {
        href: '/badges',
        labelKey: 'nav.badges',
        descKey: 'nav.descriptions.badges',
        iconName: 'Award',
      },
      {
        href: '/points',
        labelKey: 'nav.points',
        descKey: 'nav.descriptions.points',
        iconName: 'Sparkles',
      },
    ],
  },
  {
    type: 'group',
    labelKey: 'nav.more',
    items: [
      {
        href: '/invite',
        labelKey: 'nav.invite',
        descKey: 'nav.descriptions.invite',
        iconName: 'UserPlus',
      },
      {
        href: '/docs',
        labelKey: 'nav.docs',
        descKey: 'nav.descriptions.docs',
        iconName: 'BookOpen',
      },
      {
        href: '/faq',
        labelKey: 'nav.faq',
        descKey: 'nav.descriptions.faq',
        iconName: 'HelpCircle',
      },
      {
        href: '/status',
        labelKey: 'nav.status',
        descKey: 'nav.descriptions.status',
        iconName: 'Activity',
      },
      {
        href: '/legal',
        labelKey: 'nav.legal',
        descKey: 'nav.descriptions.legal',
        iconName: 'Scale',
      },
    ],
  },
];
