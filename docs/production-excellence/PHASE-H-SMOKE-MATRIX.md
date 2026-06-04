# Phase H — Production Smoke Test Matrix

Status key: **PASS** | **FAIL** | **NEEDS REVIEW**

## AUTH

| Test | Desktop | Mobile | AR RTL |
|------|---------|--------|--------|
| Anonymous signup + recovery code | NEEDS REVIEW | NEEDS REVIEW | NEEDS REVIEW |
| Recovery redeem | NEEDS REVIEW | NEEDS REVIEW | NEEDS REVIEW |
| Email signup/login | NEEDS REVIEW | NEEDS REVIEW | NEEDS REVIEW |
| Google OAuth → dashboard | NEEDS REVIEW | NEEDS REVIEW | NEEDS REVIEW |
| Password reset email → set password | NEEDS REVIEW | NEEDS REVIEW | NEEDS REVIEW |

## PATIENT

| Test | Desktop | Mobile |
|------|---------|--------|
| Dashboard load | NEEDS REVIEW | NEEDS REVIEW |
| Notes read | NEEDS REVIEW | NEEDS REVIEW |
| Chat send + stream | NEEDS REVIEW | NEEDS REVIEW |
| Voice record + playback | NEEDS REVIEW | NEEDS REVIEW |
| Attachment upload | NEEDS REVIEW | NEEDS REVIEW |
| Navigate away mid-stream | NEEDS REVIEW | NEEDS REVIEW |

## ACTIVITIES

| Runner | Status |
|--------|--------|
| CBT | NEEDS REVIEW |
| Image interpretation | NEEDS REVIEW |
| Educational video | NEEDS REVIEW |
| Spot difference | NEEDS REVIEW |

## DOCTOR

| Test | Status |
|------|--------|
| `/doctor-login` bootstrap | NEEDS REVIEW |
| Portal patient list | NEEDS REVIEW |
| Patient workspace sessions | NEEDS REVIEW |
| AI assist panel | NEEDS REVIEW |

## ADMIN

| Test | Status |
|------|--------|
| Promote/revoke doctor role | NEEDS REVIEW |

## INFRA

| Test | Status |
|------|--------|
| Signed URL playback (voice/image) | NEEDS REVIEW |
| Edge 401 without JWT | NEEDS REVIEW |
| Error boundary recovery | NEEDS REVIEW |

> Execute on staging after deploy; mark PASS/FAIL in this file or run sheet.
