import type { ThemeConfig } from 'antd';

export const antdTheme: ThemeConfig = {
  token: {
    // Brand Palette
    colorPrimary: '#18181B', // Dark obsidian / zinc-900
    colorPrimaryHover: '#27272A',
    colorPrimaryActive: '#09090B',
    colorSuccess: '#10B981', // Emerald
    colorWarning: '#F59E0B', // Amber
    colorError: '#EF4444',   // Rose / Red
    colorInfo: '#3B82F6',    // Blue
    
    // Backgrounds & Surfaces
    colorBgBase: '#FFFFFF',
    colorBgLayout: '#FAFAF8',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    
    // Text & Borders
    colorTextBase: '#18181B',
    colorTextSecondary: '#71717A',
    colorTextTertiary: '#A1A1AA',
    colorTextQuaternary: '#D4D4D8',
    colorBorder: '#E4E4E7',
    colorBorderSecondary: '#F4F4F5',
    
    // Typography & Geometry
    fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontFamilyCode: 'var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    fontSize: 13.5,
    borderRadius: 10,
    borderRadiusLG: 14,
    borderRadiusSM: 6,
    borderRadiusXS: 4,
    
    // Shadows
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    boxShadowSecondary: '0 4px 12px 0 rgba(0, 0, 0, 0.08), 0 1px 3px 0 rgba(0, 0, 0, 0.04)',
    boxShadowTertiary: '0 12px 32px 0 rgba(0, 0, 0, 0.12), 0 2px 6px 0 rgba(0, 0, 0, 0.04)',
  },
  components: {
    Button: {
      controlHeight: 36,
      controlHeightLG: 42,
      controlHeightSM: 28,
      borderRadius: 8,
      borderRadiusLG: 10,
      borderRadiusSM: 6,
      defaultBorderColor: '#E4E4E7',
      defaultColor: '#18181B',
      defaultBg: '#FFFFFF',
      defaultHoverBg: '#F4F4F5',
      defaultHoverBorderColor: '#D4D4D8',
      defaultHoverColor: '#09090B',
    },
    Card: {
      borderRadiusLG: 14,
      headerHeight: 48,
      headerFontSize: 14,
      colorBorderSecondary: '#E4E4E7',
    },
    Table: {
      borderRadius: 12,
      headerBg: '#FAFAF8',
      headerColor: '#52525B',
      headerSplitColor: 'transparent',
      borderColor: '#F4F4F5',
      rowHoverBg: '#FAFAFA',
      fontSize: 13,
      cellPaddingBlock: 12,
      cellPaddingInline: 14,
    },
    Tabs: {
      itemColor: '#71717A',
      itemSelectedColor: '#18181B',
      itemHoverColor: '#27272A',
      titleFontSize: 13.5,
      inkBarColor: '#18181B',
      horizontalItemPadding: '10px 14px',
      cardBg: '#F4F4F5',
    },
    Modal: {
      borderRadiusLG: 18,
      titleFontSize: 16,
    },
    Drawer: {
      borderRadiusLG: 18,
    },
    Tag: {
      borderRadiusSM: 6,
      fontSize: 11.5,
      lineHeight: 1.6,
    },
    Badge: {
      fontSize: 11,
      indicatorHeight: 18,
    },
    Input: {
      controlHeight: 38,
      borderRadius: 8,
      colorBorder: '#E4E4E7',
      hoverBorderColor: '#A1A1AA',
      activeBorderColor: '#18181B',
    },
    Select: {
      controlHeight: 38,
      borderRadius: 8,
      colorBorder: '#E4E4E7',
      hoverBorderColor: '#A1A1AA',
      activeBorderColor: '#18181B',
    },
    Segmented: {
      borderRadius: 9,
      trackBg: '#F4F4F5',
      itemSelectedBg: '#FFFFFF',
      itemColor: '#71717A',
      itemSelectedColor: '#18181B',
      itemHoverColor: '#18181B',
    },
    Collapse: {
      borderRadiusLG: 12,
      headerBg: '#FAFAF8',
      contentBg: '#FFFFFF',
      colorBorder: '#E4E4E7',
    },
    Tooltip: {
      borderRadius: 6,
      colorBgSpotlight: '#18181B',
      fontSize: 12,
    },
    Statistic: {
      titleFontSize: 12,
      contentFontSize: 24,
      fontFamily: 'var(--font-inter), sans-serif',
    },
    Alert: {
      borderRadiusLG: 10,
      fontSize: 13,
    },
    Divider: {
      colorSplit: '#F4F4F5',
    },
  },
};
