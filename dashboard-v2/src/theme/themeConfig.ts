import { theme, type ThemeConfig } from 'antd';

export const antdTheme: ThemeConfig = {
  algorithm: theme.compactAlgorithm,
  token: {
    // LoopCV Signature Brand Palette (Refined Azure Blue & Cool Slate)
    colorPrimary: '#2563EB', // Blue-600 (LoopCV Azure)
    colorPrimaryHover: '#1D4ED8', // Blue-700
    colorPrimaryActive: '#1E40AF', // Blue-800
    colorSuccess: '#10B981', // Emerald
    colorWarning: '#F59E0B', // Amber
    colorError: '#EF4444',   // Rose / Red
    colorInfo: '#3B82F6',    // Blue
    
    // Backgrounds & Surfaces (Cool Clean Slate)
    colorBgBase: '#FFFFFF',
    colorBgLayout: '#F8FAFC',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    
    // Text & Borders (Deep LoopCV Navy & Slate)
    colorTextBase: '#081929',
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
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    borderRadiusXS: 4,
    
    // Modern LoopCV Card Elevation & Ambient Soft Shadows
    boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)',
    boxShadowSecondary: '0 12px 28px -4px rgba(37, 99, 235, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.04)',
    boxShadowTertiary: '0 20px 40px -4px rgba(37, 99, 235, 0.14), 0 6px 16px -2px rgba(15, 23, 42, 0.05)',
  },
  components: {
    Button: {
      controlHeight: 32,
      controlHeightLG: 40,
      controlHeightSM: 26,
      borderRadius: 8,
      borderRadiusLG: 10,
      borderRadiusSM: 6,
      defaultBorderColor: '#E2E8F0',
      defaultColor: '#081929',
      defaultBg: '#FFFFFF',
      defaultHoverBg: '#F8FAFC',
      defaultHoverBorderColor: '#93C5FD',
      defaultHoverColor: '#2563EB',
      paddingInline: 14,
      paddingInlineSM: 10,
    },
    Card: {
      borderRadiusLG: 16,
      headerHeight: 42,
      headerFontSize: 13.5,
      colorBorderSecondary: '#EDF0F6',
    },
    Table: {
      borderRadius: 12,
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
      itemSelectedColor: '#2563EB',
      itemHoverColor: '#1D4ED8',
      titleFontSize: 13,
      inkBarColor: '#2563EB',
      horizontalItemPadding: '8px 14px',
      cardBg: '#F1F5F9',
    },
    Modal: {
      borderRadiusLG: 16,
      titleFontSize: 15,
    },
    Drawer: {
      borderRadiusLG: 16,
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
      activeBorderColor: '#2563EB',
    },
    Select: {
      controlHeight: 32,
      borderRadius: 8,
      colorBorder: '#E2E8F0',
      hoverBorderColor: '#93C5FD',
      activeBorderColor: '#2563EB',
    },
    Segmented: {
      borderRadius: 8,
      trackBg: '#F1F5F9',
      itemSelectedBg: '#FFFFFF',
      itemColor: '#64748B',
      itemSelectedColor: '#2563EB',
      itemHoverColor: '#2563EB',
    },
    Collapse: {
      borderRadiusLG: 12,
      headerBg: '#F8FAFC',
      contentBg: '#FFFFFF',
      colorBorder: '#E2E8F0',
    },
    Tooltip: {
      borderRadius: 6,
      colorBgSpotlight: '#081929',
      fontSize: 11.5,
    },
    Statistic: {
      titleFontSize: 12,
      contentFontSize: 22,
      fontFamily: 'var(--font-inter), sans-serif',
    },
    Alert: {
      borderRadiusLG: 12,
      fontSize: 12.5,
    },
    Divider: {
      colorSplit: '#F1F5F9',
    },
  },
};
