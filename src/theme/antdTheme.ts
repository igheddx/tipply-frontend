import { theme, type ThemeConfig } from 'antd'

/** Ant Design theme that matches the Tipwave brand (see tailwind.config.js for the same colors). */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#0E7490',
    colorInfo: '#0891A6',
    colorSuccess: '#15803D',
    colorWarning: '#B45309',
    colorError: '#DC2626',
    colorLink: '#0E7490',
    colorTextBase: '#1B2530',
    colorBgLayout: '#F5F7FA',
    borderRadius: 10,
    fontFamily:
      "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
  },
  components: {
    Tabs: { itemSelectedColor: '#0E7490', inkBarColor: '#0E7490' },
    Table: { headerBg: '#F8FAFC', headerColor: '#64748B', borderColor: '#F1F5F9', rowHoverBg: '#F8FAFC', headerSplitColor: 'transparent' }
  }
}

/** The same theme for the dark portal screens. */
export const antdDarkTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#22AABE',
    colorInfo: '#22AABE',
    colorSuccess: '#4ADE80',
    colorWarning: '#FBBF24',
    colorError: '#F87171',
    colorLink: '#62D3E3',
    colorTextBase: '#EAF3F7',
    colorBgBase: '#112b3a',
    colorBgContainer: '#112b3a',
    colorBgElevated: '#16384a',
    colorBgLayout: '#0a1c27',
    colorBorder: 'rgba(255,255,255,0.2)',
    colorBorderSecondary: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    fontFamily:
      "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
  },
  components: {
    Tabs: { itemSelectedColor: '#62D3E3', inkBarColor: '#22AABE' },
    Table: { headerBg: '#0e2533', headerColor: '#94ABB6', borderColor: 'rgba(255,255,255,0.08)', rowHoverBg: '#16384a', headerSplitColor: 'transparent' }
  }
}
