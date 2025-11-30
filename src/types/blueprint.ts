/**
 * Core protocols for InDesign <-> HTML exchange
 * Enhanced for High-Fidelity Visual Reproduction
 */

export type SlotType = 'TEXT' | 'IMAGE' | 'RECT' | 'OVAL' | 'LINE';

export interface SlotBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StyleDefinition {
  /** InDesign style name */
  name: string;
  /** Generated CSS string (e.g. "font-size: 12pt; color: #ff0000;") */
  css: string;
  /** Raw properties for precise reconstruction if needed */
  raw?: {
    fontFamily?: string;
    fontSize?: number;
    fillColor?: string; // Hex
    justification?: string;
  };
}

export interface PageItemDefinition {
  /** Unique script label (if editable) or auto-generated ID (if static) */
  id: string;
  label?: string; // Empty for static items
  type: SlotType;
  bounds: SlotBounds;
  
  /** For TextFrames: The applied paragraph style name (matches extractor output) */
  appliedParagraphStyle?: string;
  
  /** For TextFrames: The applied object style name */
  appliedObjectStyle?: string;
  
  /** For Static/Preview: Actual content if it's a static text frame */
  content?: string;
  
  /** Inline CSS overrides extracted from the element */
  inlineCSS?: string;
  
  /** Visual properties */
  visuals?: {
    fillColor?: string; // Hex
    strokeColor?: string; // Hex
    strokeWeight?: number;
    opacity?: number;
    rotation?: number;
  };
  
  /** Z-index (layering order, higher is on top) */
  zIndex?: number;
}

export interface MasterPageDefinition {
  name: string;
  width: number;
  height: number;
  
  /** Editable slots (labeled items) */
  slots: { [label: string]: PageItemDefinition };
  
  /** Static background items (unlabeled) */
  staticItems: PageItemDefinition[];
}

export interface Blueprint {
  metadata: {
    exportedAt: string;
    documentName: string;
  };
  
  /** Composite Fonts: For CJK + Latin mixed typography */
  compositeFonts?: { [fontName: string]: object };
  
  /** Character Styles: Font/color overrides */
  characterStyles?: { [styleName: string]: StyleDefinition };
  
  /** Paragraph Styles: Full paragraph formatting */
  paragraphStyles?: { [styleName: string]: StyleDefinition };
  
  /** Object Styles: Frame/shape formatting */
  objectStyles?: { [styleName: string]: object };
  
  masters: { [masterName: string]: MasterPageDefinition };
}