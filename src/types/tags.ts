/**
 * HTML Tagging Constants for the AI Agent
 */

export const Tags = {
  /** The attribute indicating which InDesign master page to use */
  DATA_MASTER: 'data-master',
  
  /** The attribute indicating which named slot to fill */
  DATA_SLOT: 'data-slot',
} as const;

/**
 * Error codes for validation reporting
 */
export const ValidationErrors = {
  MASTER_NOT_FOUND: 'MASTER_NOT_FOUND',
  SLOT_NOT_FOUND: 'SLOT_NOT_FOUND',
  TYPE_MISMATCH: 'TYPE_MISMATCH',
  CONTENT_OVERFLOW: 'CONTENT_OVERFLOW',
  MISSING_ATTRIBUTE: 'MISSING_ATTRIBUTE'
} as const;
