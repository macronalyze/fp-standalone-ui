/**
 * Commodity mapping data embedded from CSV files.
 *
 * Source: import_commodity_mapping.csv / export_commodity_mapping.csv
 * Header row is skipped. Each entry maps a human-readable PDF label to one
 * or more Excel commodity identifiers as they appear in importExport.json.
 *
 * Splitting on " | " produces the exact commodity strings used in the data.
 */

export interface CommodityMap {
  /** Human-readable display label (from PDF / report) */
  label: string;
  /** One or more raw commodity strings from importExport.json */
  keys: string[];
}

// ── Import mappings (30 entries) ────────────────────────────────────────────

export const IMPORT_COMMODITY_MAP: CommodityMap[] = [
  { label: 'Cotton Raw & Waste',                        keys: ['COTTON RAW INCLD. WASTE'] },
  { label: 'Vegetable Oil',                             keys: ['VEGETABLE OILS'] },
  { label: 'Pulses',                                    keys: ['PULSES'] },
  { label: 'Fruits & Vegetables',                       keys: ['FRUITS / VEGETABLE SEEDS', 'FRESH FRUITS', 'FRESH VEGETABLES', 'PROCESSED VEGETABLES', 'PROCESSED FRUITS AND JUICES'] },
  { label: 'Pulp and Waste Paper',                      keys: ['PULP AND WASTE PAPER'] },
  { label: 'Textile Yarn, Fabric & Made-ups',           keys: ['COTTON YARN', 'COTTON FABRICS, MADEUPS ETC.', 'OTH TXTL YRN, FBRIC MDUP ARTCL', 'MANMADE YARN,FABRICS,MADEUPS', 'WOLLEN YARN,FABRICS,MADEUPSETC', 'NATRL SILK YARN,FABRICS,MADEUP'] },
  { label: 'Fertilisers, Crude & Manufactured',        keys: ['FERTILEZERS CRUDE', 'FERTILEZERS MANUFACTURED'] },
  { label: 'Sulphur & Unroasted Iron Pyrites',          keys: ['SULPHER, UNROASTED IRON PYRITE'] },
  { label: 'Metaliferrous Ores & Other Minerals',       keys: ['BULK MINERALS AND ORES', 'OTHER CRUDE MINERALS', 'PROCESSED MINERALS'] },
  { label: 'Coal, Coke & Briquettes',                   keys: ['COAL,COKE AND BRIQUITTES ETC'] },
  { label: 'Petroleum, Crude & Products',               keys: ['PETROLEUM: CRUDE', 'PETROLEUM PRODUCTS'] },
  { label: 'Wood & Wood Products',                      keys: ['PLYWOOD AND ALLIED PRODUCTS', 'OTHER WOOD AND WOOD PRODUCTS'] },
  { label: 'Leather & Leather Products',                keys: ['RAW HIDES AND SKINS', 'FINISHED LEATHER', 'LEATHER GOODS', 'LEATHER GARMENTS', 'FOOTWEAR OF LEATHER', 'LEATHER FOOTWEAR COMPONENT', 'SADDLERY AND HARNESS'] },
  { label: 'Organic & Inorganic Chemicals',             keys: ['ORGANIC CHEMICALS', 'INORGANIC CHEMICALS', 'OTHER MISCELLAENIOUS CHEMICALS', 'RESIDUL CHEMICL AND ALLED PROD'] },
  { label: 'Dyeing/Tanning/Colouring Materials',        keys: ['DYES', 'DYE INTERMEDIATES'] },
  { label: 'Artificial Resins & Plastic Materials',     keys: ['PLASTIC RAW MATERIALS', 'PLASTC SHT, FILM, PLTS ETC', 'MOULDED AND EXTRUDED GOODS', 'OTHER PLASTIC ITEMS'] },
  { label: 'Chemical Materials & Products',             keys: ['AGRO CHEMICALS', 'COSMETICS AND TOILETRIES', 'ESSENTIAL OILS', 'PAINT, VARNISH AND ALLID PRODC', 'OTHER MISCELLAENIOUS CHEMICALS'] },
  { label: 'Newsprint',                                 keys: ['NEWSPRINT'] },
  { label: 'Pearls, Precious & Semi-precious Stones',   keys: ['PEARL, PRECS, SEMIPRECS STONES'] },
  { label: 'Iron & Steel',                              keys: ['IRON AND STEEL', 'PRODUCTS OF IRON AND STEEL'] },
  { label: 'Non-ferrous Metals',                        keys: ['ALUMINIUM, PRODUCTS OF ALUMINM', 'COPPER AND PRDCTS MADE OF COPR', 'LEAD AND PRODUCTS MADE OF LED', 'NICKEL, PRODUCT MADE OF NICKEL', 'TIN AND PRODUCTS MADE OF TIN', 'ZINC AND PRODUCTS MADE OF ZINC', 'OTH NON FEROUS METAL AND PRODC'] },
  { label: 'Machine Tools',                             keys: ['MACHINE TOOLS'] },
  { label: 'Machinery, Electrical & Non-electrical',    keys: ['ELECTRIC MACHINERY AND EQUIPME', 'IC ENGINES AND PARTS', 'INDL. MACHNRY FOR DAIRY ETC', 'ATM, INJCTNG MLDING MCHNRY ETC', 'NUCLER REACTR, INDL BOILR, PRT', 'OTHER CONSTRUCTION MACHINERY', 'OTHER MISC. ENGINEERING ITEMS', 'PUMPS OF ALL TYPES', 'AC, REFRIGERATION MACHNRY ETC', 'CRANES, LIFTS AND WINCHES'] },
  { label: 'Transport Equipment',                       keys: ['AIRCRAFT, SPACECRAFT AND PARTS', 'MOTOR VEHICLE/CARS', 'RAILWY TRNSPRT EQUIPMNTS, PRTS', 'SHIP, BOAT AND FLOATING STRUCT', 'TWO AND THREE WHEELERS', 'BICYCLE AND PARTS', 'AUTO COMPONENTS/PARTS'] },
  { label: 'Project Goods',                             keys: ['PROJECT GOODS'] },
  { label: 'Professional Instruments & Optical Goods',  keys: ['OPTICAL ITEMS (INCL.LENS ETC)', 'MEDICAL AND SCIENTIFIC INSTRUM'] },
  { label: 'Electronic Goods',                          keys: ['COMPUTER HARDWARE, PERIPHERALS', 'CONSUMER ELECTRONICS', 'ELECTRONICS COMPONENTS', 'ELECTRONICS INSTRUMENTS', 'TELECOM INSTRUMENTS'] },
  { label: 'Medicinal & Pharmaceutical Products',       keys: ['BULK DRUGS, DRUG INTERMEDIATES', 'DRUG FORMULATIONS, BIOLOGICALS'] },
  { label: 'Gold',                                      keys: ['GOLD'] },
  { label: 'Silver',                                    keys: ['SILVER'] },
];

// ── Export mappings (30 entries) ─────────────────────────────────────────────

export const EXPORT_COMMODITY_MAP: CommodityMap[] = [
  { label: 'Tea',                                              keys: ['TEA'] },
  { label: 'Coffee',                                           keys: ['COFFEE'] },
  { label: 'Rice',                                             keys: ['RICE -BASMOTI', 'RICE(OTHER THAN BASMOTI)'] },
  { label: 'Other Cereals',                                    keys: ['OTHER CEREALS'] },
  { label: 'Tobacco',                                          keys: ['TOBACCO UNMANUFACTURED', 'TOBACCO MANUFACTURED'] },
  { label: 'Spices',                                           keys: ['SPICES'] },
  { label: 'Cashew',                                           keys: ['CASHEW', 'CASHEW NUT SHELL LIQUID'] },
  { label: 'Oil Meals',                                        keys: ['OIL MEALS'] },
  { label: 'Oil Seeds',                                        keys: ['SESAME SEEDS', 'NIGER SEEDS', 'GROUNDNUT', 'OTHER OIL SEEDS'] },
  { label: 'Fruits & Vegetables',                              keys: ['FRUITS / VEGETABLE SEEDS', 'FRESH FRUITS', 'FRESH VEGETABLES', 'PROCESSED VEGETABLES', 'PROCESSED FRUITS AND JUICES'] },
  { label: 'Cereal Preparations & Misc. Processed Items',      keys: ['CEREAL PREPARATIONS', 'COCOA PRODUCTS', 'MILLED PRODUCTS', 'MISC PROCESSED ITEMS'] },
  { label: 'Marine Products',                                  keys: ['MARINE PRODUCTS'] },
  { label: 'Meat, Dairy & Poultry Products',                   keys: ['BUFFALO MEAT', 'SHEEP/GOAT MEAT', 'OTHER MEAT', 'PROCESSED MEAT', 'DAIRY PRODUCTS', 'POULTRY PRODUCTS', 'ANIMAL CASINGS'] },
  { label: 'Iron Ore',                                         keys: ['IRON ORE'] },
  { label: 'Mica, Coal & Other Ores/Minerals',                 keys: ['MICA', 'COAL,COKE AND BRIQUITTES ETC', 'BULK MINERALS AND ORES', 'GRANIT, NATRL STONE AND PRODCT', 'PROCESSED MINERALS', 'SULPHER, UNROASTED IRON PYRITE', 'OTHER CRUDE MINERALS', 'PRIME MICA AND MICA PRODUCTS'] },
  { label: 'Leather & Leather Products',                       keys: ['RAW HIDES AND SKINS', 'FINISHED LEATHER', 'LEATHER GOODS', 'LEATHER GARMENTS', 'FOOTWEAR OF LEATHER', 'LEATHER FOOTWEAR COMPONENT', 'SADDLERY AND HARNESS'] },
  { label: 'Ceramic Products & Glassware',                     keys: ['CERAMICS AND ALLIED PRODUCTS', 'GLASS AND GLASSWARE'] },
  { label: 'Gems & Jewellery',                                 keys: ['PEARL, PRECS, SEMIPRECS STONES', 'GOLD AND OTH PRECS METL JWLERY', 'OTHER PRECIOUS AND BASE METALS'] },
  { label: 'Drugs & Pharmaceuticals',                          keys: ['BULK DRUGS, DRUG INTERMEDIATES', 'DRUG FORMULATIONS, BIOLOGICALS', 'AYUSH AND HERBAL PRODUCTS', 'SURGICALS'] },
  { label: 'Organic & Inorganic Chemicals',                    keys: ['ORGANIC CHEMICALS', 'INORGANIC CHEMICALS', 'OTHER MISCELLAENIOUS CHEMICALS', 'RESIDUL CHEMICL AND ALLED PROD'] },
  { label: 'Engineering Goods',                                keys: ['IRON AND STEEL', 'PRODUCTS OF IRON AND STEEL', 'ALUMINIUM, PRODUCTS OF ALUMINM', 'COPPER AND PRDCTS MADE OF COPR', 'OTH NON FEROUS METAL AND PRODC', 'AUTO COMPONENTS/PARTS', 'MACHINE TOOLS', 'ELECTRIC MACHINERY AND EQUIPME', 'IC ENGINES AND PARTS', 'INDL. MACHNRY FOR DAIRY ETC', 'ATM, INJCTNG MLDING MCHNRY ETC', 'NUCLER REACTR, INDL BOILR, PRT', 'OTHER CONSTRUCTION MACHINERY', 'OTHER MISC. ENGINEERING ITEMS', 'PUMPS OF ALL TYPES', 'AC, REFRIGERATION MACHNRY ETC', 'CRANES, LIFTS AND WINCHES', 'AIRCRAFT, SPACECRAFT AND PARTS', 'MOTOR VEHICLE/CARS', 'RAILWY TRNSPRT EQUIPMNTS, PRTS', 'SHIP, BOAT AND FLOATING STRUCT', 'TWO AND THREE WHEELERS', 'BICYCLE AND PARTS', 'MEDICAL AND SCIENTIFIC INSTRUM', 'OFFICE EQUIPMENTS', 'ELECTRODES', 'ACCUMULATORS AND BATTERIES', 'HND TOOL, CTTNG TOOL OF METALS'] },
  { label: 'Electronic Goods',                                 keys: ['COMPUTER HARDWARE, PERIPHERALS', 'CONSUMER ELECTRONICS', 'ELECTRONICS COMPONENTS', 'ELECTRONICS INSTRUMENTS', 'TELECOM INSTRUMENTS'] },
  { label: 'Cotton Yarn/Fabrics/Made-ups & Handloom',          keys: ['COTTON YARN', 'COTTON FABRICS, MADEUPS ETC.', 'HANDLOOM PRODUCTS'] },
  { label: 'Man-made Yarn/Fabrics/Made-ups',                   keys: ['MANMADE STAPLE FIBRE', 'MANMADE YARN,FABRICS,MADEUPS'] },
  { label: 'RMG of All Textiles',                              keys: ['RMG COTTON INCL ACCESSORIES', 'RMG SILK', 'RMG MANMADE FIBRES', 'RMG WOOL', 'RMG OF OTHR TEXTLE MATRL'] },
  { label: 'Jute Mfg. incl. Floor Covering',                   keys: ['JUTE, RAW', 'JUTE YARN', 'JUTE HESSIAN', 'FLOOR CVRNG OF JUTE', 'OTHER JUTE MANUFACTURES'] },
  { label: 'Carpet',                                           keys: ['CARPET(EXCL. SILK) HANDMADE', 'SILK CARPET'] },
  { label: 'Handicrafts (excl. handmade carpet)',              keys: ['HANDCRFS(EXCL.HANDMADE CRPTS)'] },
  { label: 'Petroleum Products',                               keys: ['PETROLEUM PRODUCTS'] },
  { label: 'Plastic & Linoleum',                               keys: ['PLASTIC RAW MATERIALS', 'PLASTC SHT, FILM, PLTS ETC', 'MOULDED AND EXTRUDED GOODS', 'OTHER PLASTIC ITEMS', 'PACKAGING MATERIALS'] },
];
