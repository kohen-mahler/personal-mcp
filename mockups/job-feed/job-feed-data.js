const JOB_FEED_DATA = {
  "generatedAt": "2026-08-17",
  "wikiRoot": "../../../wiki",
  "stages": [
    "Sourced",
    "Preparing",
    "Applied",
    "Assessment",
    "Recruiter Screen",
    "Interviewing",
    "Offer",
    "Closed"
  ],
  "followUpRules": [
    {
      "id": "applied-stale",
      "label": "Applied stale",
      "trigger": "Applied at least 7 calendar days ago, no employer response, no assessment pending",
      "action": "Check portal, then follow up if there is a known contact"
    },
    {
      "id": "assessment-pending",
      "label": "Assessment pending",
      "trigger": "Assessment exists and deadline is within 48 hours",
      "action": "Prioritize completion"
    },
    {
      "id": "recruiter-silence",
      "label": "Recruiter silence",
      "trigger": "Recruiter last touched at least 2 business days ago with no next step",
      "action": "Send a short check-in"
    },
    {
      "id": "interview-thank-you",
      "label": "Interview thank-you",
      "trigger": "Interview completed yesterday and no thank-you logged",
      "action": "Send thank-you note"
    },
    {
      "id": "missing-contact",
      "label": "Missing contact",
      "trigger": "High-priority opportunity has no linked contact",
      "action": "Search wiki and attach or create contact note"
    },
    {
      "id": "missing-evidence",
      "label": "Missing evidence",
      "trigger": "Job has no mapped evidence or resume version",
      "action": "Attach evidence before next interaction"
    }
  ],
  "opportunities": [
    {
      "id": "kraft-heinz-2027-canada-internship-program",
      "company": "Kraft Heinz",
      "role": "2027 Canada Internship Program",
      "jobId": "R-105290",
      "stage": "Applied",
      "status": "Waiting for assessment or portal update",
      "priority": "Medium",
      "source": "Workday",
      "location": "Toronto, Ontario",
      "term": "May 10 to August 20, 2027",
      "compensation": "$27.40 CAD per hour, listed as $1,030 CAD weekly",
      "appliedAt": "2026-08-14",
      "lastTouchAt": "2026-08-14",
      "firstResponseAt": null,
      "deadline": "2026-10-02",
      "nextAction": "Check assessment status or candidate portal before sending any follow-up",
      "nextActionDue": "2026-08-21",
      "followUpRule": "applied-stale",
      "contacts": [],
      "wiki": {
        "tracker": "career/internship-tracker",
        "monitor": "career/job-feed-visual-tracker",
        "sourcePage": "sources/kraft-heinz-2027-canada-internship-r-105290",
        "companyPage": "entities/kraft-heinz",
        "contactIndex": "entities/networking/INDEX",
        "evidence": "career/application-evidence"
      },
      "descriptionSignals": [
        {
          "signal": "Leadership development program",
          "topics": [
            "learning/leadership",
            "learning/interview-stories"
          ],
          "why": "Interview answers should show ownership and growth"
        },
        {
          "signal": "Simplifying complex concepts",
          "topics": [
            "learning/communication",
            "learning/product-thinking"
          ],
          "why": "Strong story fit for translating messy work into useful outcomes"
        },
        {
          "signal": "Consumer insight and Gen Z examples",
          "topics": [
            "learning/marketing",
            "learning/consumer-insight"
          ],
          "why": "Useful for business-case or behavioral prep"
        },
        {
          "signal": "Supply-chain tracking example",
          "topics": [
            "learning/supply-chain",
            "learning/operations"
          ],
          "why": "Connects to systems thinking and dashboard work"
        },
        {
          "signal": "ESG packaging example",
          "topics": [
            "learning/esg",
            "learning/sustainability"
          ],
          "why": "Potential business challenge angle"
        }
      ],
      "evidenceMatches": [
        "Vision Fillers dashboard and workflow work",
        "Event logistics and partner coordination through AFP",
        "Verified Canadian work authorization"
      ],
      "timeline": [
        {
          "date": "2026-08-14",
          "label": "Applied",
          "detail": "Submitted application"
        },
        {
          "date": "2026-08-21",
          "label": "Follow-up threshold",
          "detail": "Seven-day review point"
        }
      ],
      "decisionNotes": [
        "Function is determined by business need and candidate preference.",
        "Housing is provided for the internship duration.",
        "Assessment status is still unknown."
      ]
    },
    {
      "id": "kpmg-canada-risk-services-technology-risk-services-intern-or-co-op",
      "company": "KPMG Canada",
      "role": "Risk Services, Technology Risk Services Intern or Co-op",
      "jobId": "33316",
      "stage": "Applied",
      "status": "Waiting for portal update",
      "priority": "High",
      "source": "KPMG Careers",
      "location": "Toronto, Ottawa, St. John's, or Halifax",
      "term": "Winter, Summer, or Fall 2027",
      "compensation": "$41,000 to $65,000 annualized base salary for the Ontario region",
      "appliedAt": "2026-08-14",
      "lastTouchAt": "2026-08-14",
      "firstResponseAt": null,
      "deadline": "2026-09-07",
      "nextAction": "Check portal status and confirm selected office/term if available",
      "nextActionDue": "2026-08-21",
      "followUpRule": "applied-stale",
      "contacts": [],
      "wiki": {
        "tracker": "career/internship-tracker",
        "monitor": "career/job-feed-visual-tracker",
        "sourcePage": "sources/kpmg-technology-risk-services-intern-coop-33316",
        "companyPage": "entities/kpmg-canada",
        "contactIndex": "entities/networking/INDEX",
        "evidence": "career/application-evidence",
        "coverLetter": "skills/cover-letter"
      },
      "descriptionSignals": [
        {
          "signal": "Technology risk and controls",
          "topics": [
            "learning/technology-risk",
            "learning/internal-controls"
          ],
          "why": "Core role vocabulary"
        },
        {
          "signal": "Third-party reliance",
          "topics": [
            "learning/vendor-risk",
            "learning/governance"
          ],
          "why": "Useful for client-risk examples"
        },
        {
          "signal": "Analytics and automation",
          "topics": [
            "learning/analytics",
            "learning/automation"
          ],
          "why": "Direct match to Vision Fillers and PAI/Pulse work"
        },
        {
          "signal": "AI-enabled tools with human judgment",
          "topics": [
            "learning/responsible-ai",
            "AI/prompt-injection-testing"
          ],
          "why": "Strong application theme and interview angle"
        },
        {
          "signal": "Client communication and documentation quality",
          "topics": [
            "learning/client-communication",
            "career/application-evidence"
          ],
          "why": "Ties to verified Vision Fillers stories"
        }
      ],
      "evidenceMatches": [
        "Vision Fillers client-system translation story",
        "PAI/Pulse automation and judgment framing",
        "Verified communication and client-work evidence"
      ],
      "timeline": [
        {
          "date": "2026-08-14",
          "label": "Applied",
          "detail": "Submitted application"
        },
        {
          "date": "2026-08-21",
          "label": "Follow-up threshold",
          "detail": "Seven-day review point"
        }
      ],
      "decisionNotes": [
        "Selected office and term are still unknown.",
        "Cover letter, resume, and unofficial transcript were required.",
        "Responsible AI and human judgment are strong interview angles."
      ]
    }
  ],
  "reinforcement": {
    "principle": "Every user action should leave structured state behind so the next dashboard render is smarter.",
    "writebackLog": [],
    "loops": [
      {
        "event": "Stage updated",
        "writeback": "Update tracker row and append a timeline event",
        "reinforcement": "Recompute funnel counts, conversion, days in stage, and next action"
      },
      {
        "event": "Follow-up sent",
        "writeback": "Set lastTouchAt, append message/contact link, clear or move nextActionDue",
        "reinforcement": "Suppress duplicate reminders and start recruiter-silence timer if a contact exists"
      },
      {
        "event": "Contact attached",
        "writeback": "Link contact note to company, opportunity, and monitor",
        "reinforcement": "Upgrade future suggestions from portal checks to relationship-aware follow-ups"
      },
      {
        "event": "Job description archived",
        "writeback": "Create source note and map description signals to learning topics",
        "reinforcement": "Improve prep prompts and evidence matching without copying descriptions into the tracker"
      },
      {
        "event": "Outcome logged",
        "writeback": "Record offer/rejection/withdrawal and capture lesson",
        "reinforcement": "Improve rates, source quality, and future evidence selection"
      }
    ]
  }
};

globalThis.JOB_FEED_DATA = JOB_FEED_DATA;
