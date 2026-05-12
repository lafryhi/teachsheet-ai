import {
  difficultyLabelFromIndex,
  getDifficultyIndex,
  normalizeMode
} from "./curriculumRules.js";

function createStageWindow({ count, fromRatio, toRatio, difficultyIndex, stage }) {
  const start = Math.floor(count * fromRatio);
  const end = Math.min(count, Math.ceil(count * toRatio));
  const slots = [];

  for (let index = start; index < end; index += 1) {
    slots.push({
      index,
      stage,
      difficulty: difficultyLabelFromIndex(difficultyIndex),
      difficultyIndex
    });
  }

  return slots;
}

export function buildDifficultyPlan({
  difficulty = "medium",
  count = 15,
  mode = "practice"
}) {
  const normalizedMode = normalizeMode(mode);
  const baseIndex = getDifficultyIndex(difficulty);

  if (count <= 0) {
    return [];
  }

  let stageDefinitions;

  if (normalizedMode === "remediation") {
    stageDefinitions = [
      { fromRatio: 0, toRatio: 0.5, difficultyIndex: 0, stage: "foundation" },
      { fromRatio: 0.5, toRatio: 0.85, difficultyIndex: Math.min(baseIndex, 1), stage: "guided" },
      { fromRatio: 0.85, toRatio: 1, difficultyIndex: Math.min(baseIndex, 1), stage: "bridge" }
    ];
  } else if (normalizedMode === "review") {
    stageDefinitions = [
      { fromRatio: 0, toRatio: 0.35, difficultyIndex: Math.max(0, baseIndex - 1), stage: "warmup" },
      { fromRatio: 0.35, toRatio: 0.75, difficultyIndex: Math.min(baseIndex, 1), stage: "mixed-practice" },
      { fromRatio: 0.75, toRatio: 1, difficultyIndex: Math.min(2, baseIndex), stage: "check-understanding" }
    ];
  } else if (normalizedMode === "challenge") {
    stageDefinitions = [
      { fromRatio: 0, toRatio: 0.2, difficultyIndex: Math.max(0, baseIndex - 1), stage: "launch" },
      { fromRatio: 0.2, toRatio: 0.65, difficultyIndex: baseIndex, stage: "build" },
      { fromRatio: 0.65, toRatio: 1, difficultyIndex: Math.min(2, baseIndex + 1), stage: "stretch" }
    ];
  } else {
    stageDefinitions = [
      { fromRatio: 0, toRatio: 0.3, difficultyIndex: Math.max(0, baseIndex - 1), stage: "warmup" },
      { fromRatio: 0.3, toRatio: 0.75, difficultyIndex: baseIndex, stage: "core" },
      { fromRatio: 0.75, toRatio: 1, difficultyIndex: Math.min(2, baseIndex + 1), stage: "stretch" }
    ];
  }

  const seededPlan = new Array(count).fill(null);

  stageDefinitions.flatMap((definition) => createStageWindow({
    count,
    ...definition
  })).forEach((slot) => {
    if (slot.index < count) {
      seededPlan[slot.index] = slot;
    }
  });

  return seededPlan.map((slot, index) => slot || {
    index,
    stage: "core",
    difficulty: difficultyLabelFromIndex(baseIndex),
    difficultyIndex: baseIndex
  });
}
