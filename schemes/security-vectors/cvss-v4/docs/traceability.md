# Traceability Matrix

> Source: FIRST CVSS v4.0 Specification Document, https://www.first.org/cvss/v4.0/specification-document (published November 2023).

## Concepts

| Concept ID | Name | Source | Reference |
|------------|------|--------|-----------|
| AV_N | Attack Vector: Network | CVSS v4.0 Spec | Section 2.1 (Attack Vector) |
| AV_A | Attack Vector: Adjacent | CVSS v4.0 Spec | Section 2.1 (Attack Vector) |
| AV_L | Attack Vector: Local | CVSS v4.0 Spec | Section 2.1 (Attack Vector) |
| AV_P | Attack Vector: Physical | CVSS v4.0 Spec | Section 2.1 (Attack Vector) |
| AC_L | Attack Complexity: Low | CVSS v4.0 Spec | Section 2.1 (Attack Complexity) |
| AC_H | Attack Complexity: High | CVSS v4.0 Spec | Section 2.1 (Attack Complexity) |
| AT_N | Attack Requirements: None | CVSS v4.0 Spec | Section 2.1 (Attack Requirements) |
| AT_P | Attack Requirements: Present | CVSS v4.0 Spec | Section 2.1 (Attack Requirements) |
| PR_N | Privileges Required: None | CVSS v4.0 Spec | Section 2.1 (Privileges Required) |
| PR_L | Privileges Required: Low | CVSS v4.0 Spec | Section 2.1 (Privileges Required) |
| PR_H | Privileges Required: High | CVSS v4.0 Spec | Section 2.1 (Privileges Required) |
| UI_N | User Interaction: None | CVSS v4.0 Spec | Section 2.1 (User Interaction) |
| UI_P | User Interaction: Passive | CVSS v4.0 Spec | Section 2.1 (User Interaction) |
| UI_A | User Interaction: Active | CVSS v4.0 Spec | Section 2.1 (User Interaction) |
| VC_H | Vulnerable System Confidentiality: High | CVSS v4.0 Spec | Section 2.2 (Vulnerable System Impact) |
| VC_L | Vulnerable System Confidentiality: Low | CVSS v4.0 Spec | Section 2.2 (Vulnerable System Impact) |
| VC_N | Vulnerable System Confidentiality: None | CVSS v4.0 Spec | Section 2.2 (Vulnerable System Impact) |
| VI_H | Vulnerable System Integrity: High | CVSS v4.0 Spec | Section 2.2 (Vulnerable System Impact) |
| VI_L | Vulnerable System Integrity: Low | CVSS v4.0 Spec | Section 2.2 (Vulnerable System Impact) |
| VI_N | Vulnerable System Integrity: None | CVSS v4.0 Spec | Section 2.2 (Vulnerable System Impact) |
| VA_H | Vulnerable System Availability: High | CVSS v4.0 Spec | Section 2.2 (Vulnerable System Impact) |
| VA_L | Vulnerable System Availability: Low | CVSS v4.0 Spec | Section 2.2 (Vulnerable System Impact) |
| VA_N | Vulnerable System Availability: None | CVSS v4.0 Spec | Section 2.2 (Vulnerable System Impact) |
| SC_H | Subsequent System Confidentiality: High | CVSS v4.0 Spec | Section 2.2 (Subsequent System Impact) |
| SC_L | Subsequent System Confidentiality: Low | CVSS v4.0 Spec | Section 2.2 (Subsequent System Impact) |
| SC_N | Subsequent System Confidentiality: None | CVSS v4.0 Spec | Section 2.2 (Subsequent System Impact) |
| SI_H | Subsequent System Integrity: High | CVSS v4.0 Spec | Section 2.2 (Subsequent System Impact) |
| SI_L | Subsequent System Integrity: Low | CVSS v4.0 Spec | Section 2.2 (Subsequent System Impact) |
| SI_N | Subsequent System Integrity: None | CVSS v4.0 Spec | Section 2.2 (Subsequent System Impact) |
| SA_H | Subsequent System Availability: High | CVSS v4.0 Spec | Section 2.2 (Subsequent System Impact) |
| SA_L | Subsequent System Availability: Low | CVSS v4.0 Spec | Section 2.2 (Subsequent System Impact) |
| SA_N | Subsequent System Availability: None | CVSS v4.0 Spec | Section 2.2 (Subsequent System Impact) |
| E_X | Exploit Maturity: Not Defined | CVSS v4.0 Spec | Section 3 (Threat Metrics) |
| E_A | Exploit Maturity: Attacked | CVSS v4.0 Spec | Section 3 (Threat Metrics) |
| E_P | Exploit Maturity: POC | CVSS v4.0 Spec | Section 3 (Threat Metrics) |
| E_U | Exploit Maturity: Unreported | CVSS v4.0 Spec | Section 3 (Threat Metrics) |
| SEV_CRITICAL | Critical | CVSS v4.0 Spec | Section 6 (Qualitative Severity Rating Scale) |
| SEV_HIGH | High | CVSS v4.0 Spec | Section 6 (Qualitative Severity Rating Scale) |
| SEV_MEDIUM | Medium | CVSS v4.0 Spec | Section 6 (Qualitative Severity Rating Scale) |
| SEV_LOW | Low | CVSS v4.0 Spec | Section 6 (Qualitative Severity Rating Scale) |
| SEV_NONE | None | CVSS v4.0 Spec | Section 6 (Qualitative Severity Rating Scale) |
| S_X | Safety: Not Defined | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| S_N | Safety: Negligible | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| S_P | Safety: Present | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| AU_X | Automatable: Not Defined | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| AU_N | Automatable: No | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| AU_Y | Automatable: Yes | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| R_X | Recovery: Not Defined | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| R_A | Recovery: Automatic | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| R_U | Recovery: User | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| R_I | Recovery: Irrecoverable | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| V_X | Value Density: Not Defined | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| V_D | Value Density: Diffuse | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| V_C | Value Density: Concentrated | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| RE_X | Vulnerability Response Effort: Not Defined | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| RE_L | Vulnerability Response Effort: Low | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| RE_M | Vulnerability Response Effort: Moderate | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| RE_H | Vulnerability Response Effort: High | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| U_X | Provider Urgency: Not Defined | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| U_CLEAR | Provider Urgency: Clear | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| U_GREEN | Provider Urgency: Green | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| U_AMBER | Provider Urgency: Amber | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| U_RED | Provider Urgency: Red | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| CR_X | Confidentiality Requirement: Not Defined | CVSS v4.0 Spec | Section 4.1 (Security Requirements) |
| CR_H | Confidentiality Requirement: High | CVSS v4.0 Spec | Section 4.1 (Security Requirements) |
| CR_M | Confidentiality Requirement: Medium | CVSS v4.0 Spec | Section 4.1 (Security Requirements) |
| CR_L | Confidentiality Requirement: Low | CVSS v4.0 Spec | Section 4.1 (Security Requirements) |
| IR_X | Integrity Requirement: Not Defined | CVSS v4.0 Spec | Section 4.1 (Security Requirements) |
| IR_H | Integrity Requirement: High | CVSS v4.0 Spec | Section 4.1 (Security Requirements) |
| IR_M | Integrity Requirement: Medium | CVSS v4.0 Spec | Section 4.1 (Security Requirements) |
| IR_L | Integrity Requirement: Low | CVSS v4.0 Spec | Section 4.1 (Security Requirements) |
| AR_X | Availability Requirement: Not Defined | CVSS v4.0 Spec | Section 4.1 (Security Requirements) |
| AR_H | Availability Requirement: High | CVSS v4.0 Spec | Section 4.1 (Security Requirements) |
| AR_M | Availability Requirement: Medium | CVSS v4.0 Spec | Section 4.1 (Security Requirements) |
| AR_L | Availability Requirement: Low | CVSS v4.0 Spec | Section 4.1 (Security Requirements) |
| MAV_X | Modified Attack Vector: Not Defined | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MAV_N | Modified Attack Vector: Network | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MAV_A | Modified Attack Vector: Adjacent | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MAV_L | Modified Attack Vector: Local | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MAV_P | Modified Attack Vector: Physical | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MAC_X | Modified Attack Complexity: Not Defined | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MAC_L | Modified Attack Complexity: Low | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MAC_H | Modified Attack Complexity: High | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MAT_X | Modified Attack Requirements: Not Defined | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MAT_N | Modified Attack Requirements: None | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MAT_P | Modified Attack Requirements: Present | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MPR_X | Modified Privileges Required: Not Defined | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MPR_N | Modified Privileges Required: None | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MPR_L | Modified Privileges Required: Low | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MPR_H | Modified Privileges Required: High | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MUI_X | Modified User Interaction: Not Defined | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MUI_N | Modified User Interaction: None | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MUI_P | Modified User Interaction: Passive | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MUI_A | Modified User Interaction: Active | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MVC_X | Modified Vulnerable System Confidentiality: Not Defined | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MVC_H | Modified Vulnerable System Confidentiality: High | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MVC_L | Modified Vulnerable System Confidentiality: Low | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MVC_N | Modified Vulnerable System Confidentiality: None | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MVI_X | Modified Vulnerable System Integrity: Not Defined | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MVI_H | Modified Vulnerable System Integrity: High | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MVI_L | Modified Vulnerable System Integrity: Low | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MVI_N | Modified Vulnerable System Integrity: None | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MVA_X | Modified Vulnerable System Availability: Not Defined | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MVA_H | Modified Vulnerable System Availability: High | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MVA_L | Modified Vulnerable System Availability: Low | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MVA_N | Modified Vulnerable System Availability: None | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MSC_X | Modified Subsequent System Confidentiality: Not Defined | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MSC_H | Modified Subsequent System Confidentiality: High | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MSC_L | Modified Subsequent System Confidentiality: Low | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MSC_N | Modified Subsequent System Confidentiality: None | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MSI_X | Modified Subsequent System Integrity: Not Defined | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MSI_S | Modified Subsequent System Integrity: Safety | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MSI_H | Modified Subsequent System Integrity: High | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MSI_L | Modified Subsequent System Integrity: Low | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MSI_N | Modified Subsequent System Integrity: None | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MSA_X | Modified Subsequent System Availability: Not Defined | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MSA_S | Modified Subsequent System Availability: Safety | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MSA_H | Modified Subsequent System Availability: High | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MSA_L | Modified Subsequent System Availability: Low | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| MSA_N | Modified Subsequent System Availability: None | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |

## Categories

| Category ID | Label | Source | Reference |
|-------------|-------|--------|-----------|
| attack_vector | Attack Vector (AV) | CVSS v4.0 Spec | Section 2.1 (Attack Vector) |
| attack_complexity | Attack Complexity (AC) | CVSS v4.0 Spec | Section 2.1 (Attack Complexity) |
| attack_requirements | Attack Requirements (AT) | CVSS v4.0 Spec | Section 2.1 (Attack Requirements) |
| privileges_required | Privileges Required (PR) | CVSS v4.0 Spec | Section 2.1 (Privileges Required) |
| user_interaction | User Interaction (UI) | CVSS v4.0 Spec | Section 2.1 (User Interaction) |
| vc_impact | Vulnerable System Confidentiality (VC) | CVSS v4.0 Spec | Section 2.2 (Vulnerable System Impact) |
| vi_impact | Vulnerable System Integrity (VI) | CVSS v4.0 Spec | Section 2.2 (Vulnerable System Impact) |
| va_impact | Vulnerable System Availability (VA) | CVSS v4.0 Spec | Section 2.2 (Vulnerable System Impact) |
| sc_impact | Subsequent System Confidentiality (SC) | CVSS v4.0 Spec | Section 2.2 (Subsequent System Impact) |
| si_impact | Subsequent System Integrity (SI) | CVSS v4.0 Spec | Section 2.2 (Subsequent System Impact) |
| sa_impact | Subsequent System Availability (SA) | CVSS v4.0 Spec | Section 2.2 (Subsequent System Impact) |
| exploit_maturity | Exploit Maturity (E) | CVSS v4.0 Spec | Section 3 (Threat Metrics) |
| severity | Severity | CVSS v4.0 Spec | Section 6 (Qualitative Severity Rating Scale) |
| safety | Safety (S) | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| automatable | Automatable (AU) | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| recovery | Recovery (R) | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| value_density | Value Density (V) | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| response_effort | Vulnerability Response Effort (RE) | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| provider_urgency | Provider Urgency (U) | CVSS v4.0 Spec | Section 5 (Supplemental Metrics) |
| confidentiality_requirement | Confidentiality Requirement (CR) | CVSS v4.0 Spec | Section 4.1 (Security Requirements) |
| integrity_requirement | Integrity Requirement (IR) | CVSS v4.0 Spec | Section 4.1 (Security Requirements) |
| availability_requirement | Availability Requirement (AR) | CVSS v4.0 Spec | Section 4.1 (Security Requirements) |
| modified_attack_vector | Modified Attack Vector (MAV) | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| modified_attack_complexity | Modified Attack Complexity (MAC) | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| modified_attack_requirements | Modified Attack Requirements (MAT) | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| modified_privileges_required | Modified Privileges Required (MPR) | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| modified_user_interaction | Modified User Interaction (MUI) | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| modified_vc_impact | Modified Vulnerable System Confidentiality (MVC) | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| modified_vi_impact | Modified Vulnerable System Integrity (MVI) | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| modified_va_impact | Modified Vulnerable System Availability (MVA) | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| modified_sc_impact | Modified Subsequent System Confidentiality (MSC) | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| modified_si_impact | Modified Subsequent System Integrity (MSI) | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |
| modified_sa_impact | Modified Subsequent System Availability (MSA) | CVSS v4.0 Spec | Section 4.2 (Modified Base Metrics) |

## Key Constraints

| Constraint ID | Description | Source | Reference |
|---------------|-------------|--------|-----------|
| exclusive-attack-vector | Only one Attack Vector value may be specified | CVSS v4.0 Spec | Section 2.1 |
| exclusive-attack-complexity | Only one Attack Complexity value may be specified | CVSS v4.0 Spec | Section 2.1 |
| exclusive-attack-requirements | Only one Attack Requirements value may be specified | CVSS v4.0 Spec | Section 2.1 |
| exclusive-privileges-required | Only one Privileges Required value may be specified | CVSS v4.0 Spec | Section 2.1 |
| exclusive-user-interaction | Only one User Interaction value may be specified | CVSS v4.0 Spec | Section 2.1 |
| exclusive-vc | Only one Vulnerable System Confidentiality value may be specified | CVSS v4.0 Spec | Section 2.2 |
| exclusive-vi | Only one Vulnerable System Integrity value may be specified | CVSS v4.0 Spec | Section 2.2 |
| exclusive-va | Only one Vulnerable System Availability value may be specified | CVSS v4.0 Spec | Section 2.2 |
| exclusive-sc | Only one Subsequent System Confidentiality value may be specified | CVSS v4.0 Spec | Section 2.2 |
| exclusive-si | Only one Subsequent System Integrity value may be specified | CVSS v4.0 Spec | Section 2.2 |
| exclusive-sa | Only one Subsequent System Availability value may be specified | CVSS v4.0 Spec | Section 2.2 |
| exclusive-exploit-maturity | Only one Exploit Maturity value may be specified | CVSS v4.0 Spec | Section 3 |
| exclusive-severity | Only one Severity value may be specified | CVSS v4.0 Spec | Section 6 |
| exclusive-confidentiality-requirement | Only one Confidentiality Requirement value may be specified | CVSS v4.0 Spec | Section 4.1 |
| exclusive-integrity-requirement | Only one Integrity Requirement value may be specified | CVSS v4.0 Spec | Section 4.1 |
| exclusive-availability-requirement | Only one Availability Requirement value may be specified | CVSS v4.0 Spec | Section 4.1 |
| exclusive-modified-attack-vector | Only one Modified Attack Vector value may be specified | CVSS v4.0 Spec | Section 4.2 |
| exclusive-modified-attack-complexity | Only one Modified Attack Complexity value may be specified | CVSS v4.0 Spec | Section 4.2 |
| exclusive-modified-attack-requirements | Only one Modified Attack Requirements value may be specified | CVSS v4.0 Spec | Section 4.2 |
| exclusive-modified-privileges-required | Only one Modified Privileges Required value may be specified | CVSS v4.0 Spec | Section 4.2 |
| exclusive-modified-user-interaction | Only one Modified User Interaction value may be specified | CVSS v4.0 Spec | Section 4.2 |
| exclusive-modified-vc | Only one Modified Vulnerable System Confidentiality value may be specified | CVSS v4.0 Spec | Section 4.2 |
| exclusive-modified-vi | Only one Modified Vulnerable System Integrity value may be specified | CVSS v4.0 Spec | Section 4.2 |
| exclusive-modified-va | Only one Modified Vulnerable System Availability value may be specified | CVSS v4.0 Spec | Section 4.2 |
| exclusive-modified-sc | Only one Modified Subsequent System Confidentiality value may be specified | CVSS v4.0 Spec | Section 4.2 |
| exclusive-modified-si | Only one Modified Subsequent System Integrity value may be specified | CVSS v4.0 Spec | Section 4.2 |
| exclusive-modified-sa | Only one Modified Subsequent System Availability value may be specified | CVSS v4.0 Spec | Section 4.2 |
| exclusive-safety | Only one Safety value may be specified | CVSS v4.0 Spec | Section 5 |
| exclusive-automatable | Only one Automatable value may be specified | CVSS v4.0 Spec | Section 5 |
| exclusive-recovery | Only one Recovery value may be specified | CVSS v4.0 Spec | Section 5 |
| exclusive-value-density | Only one Value Density value may be specified | CVSS v4.0 Spec | Section 5 |
| exclusive-response-effort | Only one Vulnerability Response Effort value may be specified | CVSS v4.0 Spec | Section 5 |
| exclusive-provider-urgency | Only one Provider Urgency value may be specified | CVSS v4.0 Spec | Section 5 |
