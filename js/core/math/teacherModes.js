const VALID_TEACHER_MODES = ["practice", "homework", "assessment", "remediation", "fast-review"];

const MODE_LABELS = {
  practice: "Practice Mode",
  homework: "Homework Mode",
  assessment: "Assessment Mode",
  remediation: "Remediation Mode",
  "fast-review": "Fast Review Mode"
};

export function normalizeTeacherMode(teacherMode = "practice") {
  return VALID_TEACHER_MODES.includes(teacherMode) ? teacherMode : "practice";
}

export function getTeacherModeLabel(teacherMode = "practice") {
  return MODE_LABELS[normalizeTeacherMode(teacherMode)] || MODE_LABELS.practice;
}

export function resolvePedagogicalMode({
  mode = "practice",
  teacherMode = "practice"
} = {}) {
  if (["review", "remediation", "challenge"].includes(mode)) {
    return mode;
  }

  const resolvedTeacherMode = normalizeTeacherMode(teacherMode);

  if (resolvedTeacherMode === "remediation") {
    return "remediation";
  }

  if (resolvedTeacherMode === "assessment") {
    return "challenge";
  }

  if (resolvedTeacherMode === "fast-review") {
    return "review";
  }

  return "practice";
}

export function getTeacherModeProfile(teacherMode = "practice") {
  const resolvedTeacherMode = normalizeTeacherMode(teacherMode);

  if (resolvedTeacherMode === "homework") {
    return {
      sectionPreset: "homework",
      patternBias: {
        direct: 1.18,
        reasoning: 1,
        checking: 0.86,
        application: 1.04,
        fluency: 0.92
      }
    };
  }

  if (resolvedTeacherMode === "assessment") {
    return {
      sectionPreset: "assessment",
      patternBias: {
        direct: 1.08,
        reasoning: 1.14,
        checking: 1.12,
        application: 0.9,
        fluency: 0.82
      }
    };
  }

  if (resolvedTeacherMode === "remediation") {
    return {
      sectionPreset: "remediation",
      patternBias: {
        direct: 1.22,
        reasoning: 0.94,
        checking: 0.8,
        application: 0.88,
        fluency: 1.08
      }
    };
  }

  if (resolvedTeacherMode === "fast-review") {
    return {
      sectionPreset: "fast-review",
      patternBias: {
        direct: 1.02,
        reasoning: 0.96,
        checking: 1,
        application: 0.78,
        fluency: 1.34
      }
    };
  }

  return {
    sectionPreset: "practice",
    patternBias: {
      direct: 1.08,
      reasoning: 1,
      checking: 0.92,
      application: 1,
      fluency: 1
    }
  };
}
