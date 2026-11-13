// DRAFT: needs review by someone with clinical knowledge (NFR-20).
// Seed content for the glossary and the drug-allergy rules. Everything here is plain language written by the
// team, NOT clinically validated. Rules for the glossary (tests/glossary.test.ts enforces them):
//   - descriptions say only WHAT a test measures: no digits, no causes, no meaning of high or low, no ranges (NFR-17)
//   - questions are neutral; nothing that advises, reassures or warns (NFR-19)
// Facilities and the hospital are FICTIONAL and labelled SIMULATED (hard rule 8).

export const FACILITIES = [
  { name: "Demo General Hospital (SIMULATED)", city: "Abeokuta" },
  { name: "Sample Teaching Hospital (SIMULATED)", city: "Sagamu" },
  { name: "Example Specialist Diabetes Clinic (SIMULATED)", city: "Abeokuta" },
  { name: "Placeholder State Hospital (SIMULATED)", city: "Ijebu-Ode" },
  { name: "Mock Kidney Care Centre (SIMULATED)", city: "Ota" },
  { name: "Fictional Family Health Clinic (SIMULATED)", city: "Ilaro" },
] as const;

export const SIMULATED_HOSPITAL = { name: "Demo General Hospital (SIMULATED)", simulated: true } as const;

export interface GlossarySeed {
  test_key: string;
  display_name: string;
  aliases: string[];
  description: string;
  questions: string[];
}

const ASK_MEANING = "What does this result mean for me?";
const ASK_REPEAT = "Will this test be repeated, and when?";
const ASK_TOGETHER = "How does this result fit with my other results?";

export const GLOSSARY: GlossarySeed[] = [
  {
    test_key: "haemoglobin",
    display_name: "Haemoglobin",
    aliases: ["Haemoglobin", "Hemoglobin", "Hb", "HGB", "Hgb", "Haemoglobin (Hb)", "Hemoglobin (Hb)"],
    description: "Haemoglobin is the protein in red blood cells that carries oxygen around the body, and this test measures how much of it is in your blood.",
    questions: [ASK_MEANING, ASK_REPEAT, ASK_TOGETHER],
  },
  {
    test_key: "pcv",
    display_name: "Packed cell volume (haematocrit)",
    aliases: ["PCV", "Packed cell volume", "Haematocrit", "Hematocrit", "HCT", "Hct"],
    description: "The packed cell volume, also called haematocrit, measures the share of your blood that is made up of red blood cells.",
    questions: [ASK_MEANING, ASK_TOGETHER],
  },
  {
    test_key: "wbc",
    display_name: "White cell count",
    aliases: ["WBC", "White cell count", "White blood cell count", "White blood cells", "WCC", "Total WBC", "TWBC", "Leucocytes", "Leukocytes"],
    description: "The white cell count measures the number of white blood cells, which are part of the body's defence against infection, in a sample of your blood.",
    questions: [ASK_MEANING, ASK_REPEAT],
  },
  {
    test_key: "platelets",
    display_name: "Platelet count",
    aliases: ["Platelets", "Platelet count", "PLT", "Plt"],
    description: "The platelet count measures the number of platelets, small cells that help blood to clot, in a sample of your blood.",
    questions: [ASK_MEANING, ASK_REPEAT],
  },
  {
    test_key: "fasting_glucose",
    display_name: "Fasting blood glucose",
    aliases: ["Fasting blood glucose", "Fasting blood sugar", "FBS", "FBG", "Fasting glucose", "Fasting plasma glucose", "FPG"],
    description: "Fasting blood glucose measures the amount of sugar in your blood after a period without food.",
    questions: [ASK_MEANING, ASK_REPEAT, ASK_TOGETHER],
  },
  {
    test_key: "random_glucose",
    display_name: "Random blood glucose",
    aliases: ["Random blood glucose", "Random blood sugar", "RBS", "RBG", "Random glucose"],
    description: "Random blood glucose measures the amount of sugar in your blood at the time the sample was taken, whenever you last ate.",
    questions: [ASK_MEANING, ASK_REPEAT],
  },
  {
    test_key: "hba1c",
    display_name: "HbA1c",
    aliases: ["HbA1c", "HBA1C", "Hb A1c", "A1c", "Glycated haemoglobin", "Glycated hemoglobin", "Glycosylated haemoglobin"],
    description: "This test measures how much sugar is attached to the haemoglobin in your red blood cells, which reflects your average blood sugar over the past few months.",
    questions: [ASK_MEANING, ASK_REPEAT, ASK_TOGETHER],
  },
  {
    test_key: "creatinine",
    display_name: "Creatinine",
    aliases: ["Creatinine", "Serum creatinine", "Creat", "Cr"],
    description: "Creatinine is a waste product from muscles that the kidneys remove from the blood, and this test measures how much of it is in your blood.",
    questions: [ASK_MEANING, ASK_TOGETHER],
  },
  {
    test_key: "urea",
    display_name: "Urea",
    aliases: ["Urea", "Serum urea", "BUN", "Blood urea nitrogen", "Blood urea"],
    description: "Urea is a waste product made when the body breaks down protein, and this test measures how much of it is in your blood.",
    questions: [ASK_MEANING, ASK_TOGETHER],
  },
  {
    test_key: "sodium",
    display_name: "Sodium",
    aliases: ["Sodium", "Na", "Na+", "Serum sodium"],
    description: "Sodium is a salt that helps control the balance of water in the body, and this test measures how much of it is in your blood.",
    questions: [ASK_MEANING, ASK_TOGETHER],
  },
  {
    test_key: "potassium",
    display_name: "Potassium",
    aliases: ["Potassium", "K", "K+", "Serum potassium"],
    description: "Potassium is a salt that helps nerves and muscles, including the heart, to work, and this test measures how much of it is in your blood.",
    questions: [ASK_MEANING, ASK_TOGETHER],
  },
  {
    test_key: "alt",
    display_name: "ALT",
    aliases: ["ALT", "Alanine aminotransferase", "SGPT", "ALT (SGPT)"],
    description: "ALT, or alanine aminotransferase, is an enzyme found mainly in the liver, and this test measures how much of it is in your blood.",
    questions: [ASK_MEANING, ASK_TOGETHER],
  },
  {
    test_key: "ast",
    display_name: "AST",
    aliases: ["AST", "Aspartate aminotransferase", "SGOT", "AST (SGOT)"],
    description: "AST, or aspartate aminotransferase, is an enzyme found in the liver and other organs, and this test measures how much of it is in your blood.",
    questions: [ASK_MEANING, ASK_TOGETHER],
  },
  {
    test_key: "total_bilirubin",
    display_name: "Total bilirubin",
    aliases: ["Total bilirubin", "Bilirubin total", "T. Bilirubin", "TBIL", "T Bil", "Bilirubin"],
    description: "Bilirubin is a pigment made when old red blood cells are broken down and cleared by the liver, and this test measures the total amount in your blood.",
    questions: [ASK_MEANING, ASK_TOGETHER],
  },
  {
    test_key: "total_cholesterol",
    display_name: "Total cholesterol",
    aliases: ["Total cholesterol", "Cholesterol", "Cholesterol total", "TC", "T. Chol"],
    description: "Total cholesterol measures all the cholesterol, a fatty substance, carried in your blood.",
    questions: [ASK_MEANING, ASK_REPEAT, ASK_TOGETHER],
  },
  {
    test_key: "ldl",
    display_name: "LDL cholesterol",
    aliases: ["LDL", "LDL cholesterol", "LDL-C", "LDL-Cholesterol"],
    description: "LDL cholesterol measures the cholesterol carried in your blood by particles called LDL.",
    questions: [ASK_MEANING, ASK_TOGETHER],
  },
  {
    test_key: "hdl",
    display_name: "HDL cholesterol",
    aliases: ["HDL", "HDL cholesterol", "HDL-C", "HDL-Cholesterol"],
    description: "HDL cholesterol measures the cholesterol carried in your blood by particles called HDL.",
    questions: [ASK_MEANING, ASK_TOGETHER],
  },
  {
    test_key: "triglycerides",
    display_name: "Triglycerides",
    aliases: ["Triglycerides", "Triglyceride", "TG", "TRIG"],
    description: "Triglycerides are a type of fat carried in the blood, and this test measures how much of them is in your sample.",
    questions: [ASK_MEANING, ASK_TOGETHER],
  },
  {
    test_key: "malaria_parasite",
    display_name: "Malaria parasite",
    aliases: ["Malaria parasite", "MP", "Malaria parasites", "Blood film for malaria parasite", "BFMP", "Malaria"],
    description: "The malaria parasite test looks for malaria parasites in a sample of your blood.",
    questions: [ASK_MEANING, ASK_REPEAT],
  },
  {
    test_key: "hbsag",
    display_name: "Hepatitis B surface antigen",
    aliases: ["HBsAg", "Hepatitis B surface antigen", "HBs Ag", "Hep B surface antigen"],
    description: "The hepatitis B surface antigen test looks for a protein from the hepatitis B virus in a sample of your blood.",
    questions: [ASK_MEANING, ASK_REPEAT],
  },
  {
    test_key: "urine_protein",
    display_name: "Urinalysis: protein",
    aliases: ["Urine protein", "Protein (urine)", "Urinalysis protein", "Protein", "PRO"],
    description: "This part of a urine test checks whether protein is present in a sample of your urine.",
    questions: [ASK_MEANING, ASK_REPEAT],
  },
  {
    test_key: "urine_glucose",
    display_name: "Urinalysis: glucose",
    aliases: ["Urine glucose", "Glucose (urine)", "Urinalysis glucose", "Urine sugar", "GLU"],
    description: "This part of a urine test checks whether sugar is present in a sample of your urine.",
    questions: [ASK_MEANING, ASK_REPEAT],
  },
  {
    test_key: "esr",
    display_name: "ESR",
    aliases: ["ESR", "Erythrocyte sedimentation rate", "Sed rate"],
    description: "The erythrocyte sedimentation rate measures how quickly red blood cells settle to the bottom of a tube of blood.",
    questions: [ASK_MEANING, ASK_TOGETHER],
  },
  {
    test_key: "uric_acid",
    display_name: "Uric acid",
    aliases: ["Uric acid", "Serum uric acid", "UA", "Urate"],
    description: "Uric acid is a waste product made when the body breaks down substances called purines, and this test measures how much of it is in your blood.",
    questions: [ASK_MEANING, ASK_TOGETHER],
  },
  {
    test_key: "egfr",
    display_name: "eGFR",
    aliases: ["eGFR", "EGFR", "Estimated GFR", "Estimated glomerular filtration rate"],
    description: "The eGFR is an estimate, calculated from a blood test, of how well your kidneys are filtering your blood.",
    questions: [ASK_MEANING, ASK_REPEAT, ASK_TOGETHER],
  },
];

export interface DrugAllergyRuleSeed {
  rule_key: string;
  allergy_aliases: string[];
  medicine_aliases: string[];
  note: string;
}

const PENICILLINS = ["penicillin", "penicillins", "amoxicillin", "amoxycillin", "ampicillin", "flucloxacillin", "cloxacillin", "co-amoxiclav", "coamoxiclav", "augmentin", "ampiclox"];
const CEPHALOSPORINS = ["cephalexin", "cefalexin", "cefuroxime", "ceftriaxone", "cefixime", "cefpodoxime", "zinnat", "rocephin"];
const SULFONAMIDES = ["sulfa", "sulpha", "sulfonamide", "sulphonamide", "sulfamethoxazole", "co-trimoxazole", "cotrimoxazole", "septrin", "bactrim"];
const NSAIDS = ["nsaid", "nsaids", "aspirin", "ibuprofen", "diclofenac", "naproxen", "piroxicam", "ketoprofen"];
const MACROLIDES = ["macrolide", "macrolides", "erythromycin", "azithromycin", "clarithromycin"];

export const DRUG_ALLERGY_RULES: DrugAllergyRuleSeed[] = [
  { rule_key: "penicillins", allergy_aliases: PENICILLINS, medicine_aliases: PENICILLINS, note: "These medicines belong to the penicillin group." },
  { rule_key: "penicillin_cephalosporin", allergy_aliases: PENICILLINS, medicine_aliases: CEPHALOSPORINS, note: "Cephalosporins are related to penicillins." },
  { rule_key: "sulfonamides", allergy_aliases: SULFONAMIDES, medicine_aliases: SULFONAMIDES, note: "These medicines belong to the sulfonamide group." },
  { rule_key: "nsaids", allergy_aliases: NSAIDS, medicine_aliases: NSAIDS, note: "These medicines belong to the NSAID group." },
  { rule_key: "macrolides", allergy_aliases: MACROLIDES, medicine_aliases: MACROLIDES, note: "These medicines belong to the macrolide group." },
];
