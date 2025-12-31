/**
 * Contracts Finder Module
 *
 * Exports all Contracts Finder integration utilities.
 */

// CPV code mapping
export {
  CPV_TO_INDUSTRY,
  getCPVCodesForIndustries,
  matchCPVToIndustry,
  getIndustryFromCPV,
  getIndustriesFromCPVs,
} from './cpv-mapping';

// Supplier sync
export {
  syncSupplierFromContract,
  storeContractAward,
  markContractSignalGenerated,
  type SupplierSyncResult,
} from './supplier-sync';

// Signal detection
export {
  getContractTier,
  detectContractAwardSignal,
  detectFirstContractSignal,
  detectMultipleContractWins,
  signalExists,
  type ContractSignalCandidate,
} from './signals';
