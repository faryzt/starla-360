/**
 * Fair quiz scoring logic for Ekspedisi Rupa Nusantara.
 * - true-false & single-choice: all-or-nothing (full points if exact match, 0 otherwise).
 * - drag-drop (menjodohkan): proportional points based on how many pairs are matched correctly.
 * - multiple-choice: proportional points based on how many required correct options are selected
 *   (with excess selections beyond the required count penalizing the score so selecting all options yields 0).
 */
export function evaluateQuizQuestion(question, state) {
  if (!question) {
    return { earnedPoints: 0, isFullCorrect: false, isPartial: false, correctCount: 0, wrongCount: 0, totalCount: 1, titleText: '' };
  }

  const maxPoints = Number(question.points) || 0;

  if (question.type === 'true-false' || question.type === 'single-choice') {
    const selected = state?.selectedSingle ?? null;
    const isFullCorrect = selected !== null && selected === question.correctAnswer;
    const earnedPoints = isFullCorrect ? maxPoints : 0;
    return {
      earnedPoints,
      isFullCorrect,
      isPartial: false,
      correctCount: isFullCorrect ? 1 : 0,
      wrongCount: isFullCorrect ? 0 : 1,
      totalCount: 1,
      titleText: isFullCorrect
        ? `Jawabanmu Tepat Sekali! (+${earnedPoints} Poin)`
        : 'Belum Tepat, Mari Pelajari Bersama (+0 Poin)',
    };
  }

  if (question.type === 'multiple-choice') {
    const correctList = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
    const selectedList = Array.isArray(state?.selectedMulti) ? state.selectedMulti : [];
    const totalCount = Math.max(1, correctList.length);
    const correctCount = selectedList.filter((item) => correctList.includes(item)).length;
    const wrongCount = selectedList.filter((item) => !correctList.includes(item)).length;
    const excessWrong = Math.max(0, selectedList.length - totalCount);
    const effectiveCorrect = Math.max(0, correctCount - excessWrong);
    const earnedPoints = Math.round((effectiveCorrect / totalCount) * maxPoints);
    const isFullCorrect = correctCount === totalCount && wrongCount === 0;
    const isPartial = !isFullCorrect && earnedPoints > 0;

    let titleText = '';
    if (isFullCorrect) {
      titleText = `Jawabanmu Tepat Sekali! (+${earnedPoints} Poin • ${correctCount} Benar)`;
    } else if (isPartial) {
      titleText = `Sebagian Jawaban Benar! (+${earnedPoints} Poin • ${correctCount} Benar, ${wrongCount} Salah)`;
    } else {
      titleText = `Belum Tepat, Mari Pelajari Bersama (+0 Poin • ${correctCount} Benar, ${wrongCount} Salah)`;
    }

    return {
      earnedPoints,
      isFullCorrect,
      isPartial,
      correctCount,
      wrongCount,
      totalCount,
      titleText,
    };
  }

  if (question.type === 'drag-drop') {
    const pairs = Array.isArray(question.matchPairs) ? question.matchPairs : [];
    const matchedMap = state?.matchedPairs || {};
    const totalCount = Math.max(1, pairs.length);
    const correctCount = pairs.filter((pair) => matchedMap[pair.id] === pair.rightText).length;
    const wrongCount = totalCount - correctCount;
    const earnedPoints = Math.round((correctCount / totalCount) * maxPoints);
    const isFullCorrect = correctCount === totalCount;
    const isPartial = !isFullCorrect && earnedPoints > 0;

    let titleText = '';
    if (isFullCorrect) {
      titleText = `Jawabanmu Tepat Sekali! (+${earnedPoints} Poin • ${correctCount} dari ${totalCount} Pasangan Benar)`;
    } else if (isPartial) {
      titleText = `Sebagian Pasangan Benar! (+${earnedPoints} Poin • ${correctCount} Benar, ${wrongCount} Salah)`;
    } else {
      titleText = `Belum Tepat, Mari Pelajari Bersama (+0 Poin • 0 dari ${totalCount} Pasangan Benar)`;
    }

    return {
      earnedPoints,
      isFullCorrect,
      isPartial,
      correctCount,
      wrongCount,
      totalCount,
      titleText,
    };
  }

  return { earnedPoints: 0, isFullCorrect: false, isPartial: false, correctCount: 0, wrongCount: 0, totalCount: 1, titleText: '' };
}
