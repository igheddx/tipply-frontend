import type { ThemeConfig } from 'antd'

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
    Table: { headerBg: '#F8FAFC', headerColor: '#475569' }
  }
}
