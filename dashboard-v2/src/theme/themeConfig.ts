import { theme, type ThemeConfig } from 'antd';

export const antdTheme: ThemeConfig = {
  algorithm: theme.compactAlgorithm,
  token: {
    // LoopCV Signature Brand Palette (Electric Sapphire & Cool Slate)
    colorPrimary: '#0066FE', // LoopCV Electric Blue
    colorPrimaryHover: '#0052CC',
    colorPrimaryActive: '#003D99',
    colorSuccess: '#10B981', // Emerald Success
    colorWarning: '#F59E0B', // Amber
    colorError: '#EF4444',   // Rose / Red
    colorInfo: '#0066FE',    // Blue
    
    // Backgrounds & Surfaces (Cool Clean Slate)
    colorBgBase: '#FFFFFF',
    colorBgLayout: '#F8FAFC',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    
    // Text & Borders
    colorTextBase: '#0F172A',
    colorTextSecondary: '#475569',
    colorTextTertiary: '#94A3B8',
    colorTextQuaternary: '#CBD5E1',
    colorBorder: '#E2E8F0',
    colorBorderSecondary: '#F1F5F9',
    
    // Typography & Geometry
    fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontFamilyCode: 'var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    fontSize: 13,
    borderRadius: 8,
    borderRadiusLG: 10,
    borderRadiusSM: 6,
    borderRadiusXS: 4,
    
    // Modern LoopCV Elevation & Soft Drop Shadows
    boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)',
    boxShadowSecondary: '0 4px 20px -2px rgba(0, 102, 254, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04)',
    boxShadowTertiary: '0 16px 36px -4px rgba(0, 102, 254, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.05)',
  },
  components: {
    Button: {
      controlHeight: 32,
      controlHeightLG: 38,
      controlHeightSM: 26,
      borderRadius: 8,
      borderRadiusLG: 10,
      borderRadiusSM: 6,
      defaultBorderColor: '#E2E8F0',
      defaultColor: '#0F172A',
      defaultBg: '#FFFFFF',
      defaultHoverBg: '#F8FAFC',
      defaultHoverBorderColor: '#CBD5E1',
      defaultHoverColor: '#0066FE',
      paddingInline: 14,
      paddingInlineSM: 10,
    },
    Card: {
      borderRadiusLG: 12,
      headerHeight: 40,
      headerFontSize: 13.5,
      colorBorderSecondary: '#E2E8F0',
    },
    Table: {
      borderRadius: 10,
      headerBg: '#F8FAFC',
      headerColor: '#334155',
      headerSplitColor: 'transparent',
      borderColor: '#F1F5F9',
      rowHoverBg: '#F8FAFC',
      fontSize: 12.5,
      cellPaddingBlock: 8,
      cellPaddingInline: 12,
    },
    Tabs: {
      itemColor: '#64748B',
      itemSelectedColor: '#0066FE',
      itemHoverColor: '#0052CC',
      titleFontSize: 13,
      inkBarColor: '#0066FE',
      horizontalItemPadding: '8px 12px',
      cardBg: '#F1F5F9',
    },
    Modal: {
      borderRadiusLG: 14,
      titleFontSize: 15,
    },
    Drawer: {
      borderRadiusLG: 14,
    },
    Tag: {
      borderRadiusSM: 6,
      fontSize: 11,
      lineHeight: 1.5,
    },
    Badge: {
      fontSize: 10.5,
      indicatorHeight: 16,
    },
    Input: {
      controlHeight: 32,
      borderRadius: 8,
      colorBorder: '#E2E8F0',
      hoverBorderColor: '#93C5FD',
      activeBorderColor: '#0066FE',
    },
    Select: {
      controlHeight: 32,
      borderRadius: 8,
      colorBorder: '#E2E8F0',
      hoverBorderColor: '#93C5FD',
      activeBorderColor: '#0066FE',
    },
    Segmented: {
      borderRadius: 8,
      trackBg: '#F1F5F9',
      itemSelectedBg: '#FFFFFF',
      itemColor: '#64748B',
      itemSelectedColor: '#0066FE',
      itemHoverColor: '#0066FE',
    },
    Collapse: {
      borderRadiusLG: 10,
      headerBg: '#F8FAFC',
      contentBg: '#FFFFFF',
      colorBorder: '#E2E8F0',
    },
    Tooltip: {
      borderRadius: 6,
      colorBgSpotlight: '#0F172A',
      fontSize: 11.5,
    },
    Statistic: {
      titleFontSize: 12,
      contentFontSize: 22,
      fontFamily: 'var(--font-inter), sans-serif',
    },
    Alert: {
      borderRadiusLG: 10,
      fontSize: 12.5,
    },
    Divider: {
      colorSplit: '#F1F5F9',
    },
  },
};
