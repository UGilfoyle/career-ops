import { theme, type ThemeConfig } from 'antd';

export const antdTheme: ThemeConfig = {
  algorithm: theme.compactAlgorithm,
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
    
    // Typography & Geometry (Compact density)
    fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontFamilyCode: 'var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    fontSize: 13,
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    borderRadiusXS: 2,
    
    // Shadows
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    boxShadowSecondary: '0 4px 12px 0 rgba(0, 0, 0, 0.08), 0 1px 3px 0 rgba(0, 0, 0, 0.04)',
    boxShadowTertiary: '0 12px 32px 0 rgba(0, 0, 0, 0.12), 0 2px 6px 0 rgba(0, 0, 0, 0.04)',
  },
  components: {
    Button: {
      controlHeight: 30,
      controlHeightLG: 36,
      controlHeightSM: 24,
      borderRadius: 6,
      borderRadiusLG: 8,
      borderRadiusSM: 4,
      defaultBorderColor: '#E4E4E7',
      defaultColor: '#18181B',
      defaultBg: '#FFFFFF',
      defaultHoverBg: '#F4F4F5',
      defaultHoverBorderColor: '#D4D4D8',
      defaultHoverColor: '#09090B',
      paddingInline: 12,
      paddingInlineSM: 8,
    },
    Card: {
      borderRadiusLG: 8,
      headerHeight: 38,
      headerFontSize: 13,
      colorBorderSecondary: '#E4E4E7',
    },
    Table: {
      borderRadius: 8,
      headerBg: '#FAFAF8',
      headerColor: '#52525B',
      headerSplitColor: 'transparent',
      borderColor: '#F4F4F5',
      rowHoverBg: '#FAFAFA',
      fontSize: 12.5,
      cellPaddingBlock: 6,
      cellPaddingInline: 10,
    },
    Tabs: {
      itemColor: '#71717A',
      itemSelectedColor: '#18181B',
      itemHoverColor: '#27272A',
      titleFontSize: 12.5,
      inkBarColor: '#18181B',
      horizontalItemPadding: '6px 10px',
      cardBg: '#F4F4F5',
    },
    Modal: {
      borderRadiusLG: 12,
      titleFontSize: 14,
    },
    Drawer: {
      borderRadiusLG: 12,
    },
    Tag: {
      borderRadiusSM: 4,
      fontSize: 11,
      lineHeight: 1.4,
    },
    Badge: {
      fontSize: 10.5,
      indicatorHeight: 16,
    },
    Input: {
      controlHeight: 30,
      borderRadius: 6,
      colorBorder: '#E4E4E7',
      hoverBorderColor: '#A1A1AA',
      activeBorderColor: '#18181B',
    },
    Select: {
      controlHeight: 30,
      borderRadius: 6,
      colorBorder: '#E4E4E7',
      hoverBorderColor: '#A1A1AA',
      activeBorderColor: '#18181B',
    },
    Segmented: {
      borderRadius: 6,
      trackBg: '#F4F4F5',
      itemSelectedBg: '#FFFFFF',
      itemColor: '#71717A',
      itemSelectedColor: '#18181B',
      itemHoverColor: '#18181B',
    },
    Collapse: {
      borderRadiusLG: 8,
      headerBg: '#FAFAF8',
      contentBg: '#FFFFFF',
      colorBorder: '#E4E4E7',
    },
    Tooltip: {
      borderRadius: 4,
      colorBgSpotlight: '#18181B',
      fontSize: 11.5,
    },
    Statistic: {
      titleFontSize: 11.5,
      contentFontSize: 20,
      fontFamily: 'var(--font-inter), sans-serif',
    },
    Alert: {
      borderRadiusLG: 8,
      fontSize: 12.5,
    },
    Divider: {
      colorSplit: '#F4F4F5',
    },
  },
};
