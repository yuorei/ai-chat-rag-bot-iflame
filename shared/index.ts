/**
 * Shared module entry point
 *
 * Re-exports all shared types, constants, and utilities
 */

// UI defaults and types
export {
  // Base types (required properties)
  type ThemeColors,
  type ThemeLabels,
  type WidgetButton,
  type WidgetWindow,
  // Partial types (optional properties)
  type PartialThemeColors,
  type PartialThemeLabels,
  type PartialWidgetButton,
  type PartialWidgetWindow,
  // Composite types
  type ThemeSettings,
  type WidgetSettings,
  type ChatUISettings,
  // Default values
  DEFAULT_COLORS,
  DEFAULT_LABELS,
  DEFAULT_WIDGET_BUTTON,
  DEFAULT_WIDGET_WINDOW,
  COLOR_LABELS,
} from './constants/ui-defaults';
