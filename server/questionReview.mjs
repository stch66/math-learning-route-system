export function createQuestionReviewTools({ routeData, getQuestionsForNode }) {
  function questionReviewKey(routeKey, nodeId, questionId) {
    return `${routeKey}:${nodeId}:${questionId}`;
  }

  function applyQuestionReviews(questions, db, routeKey, nodeId) {
    const reviews = db?.questionReviews || {};
    return questions.map((question) => {
      const review = reviews[questionReviewKey(routeKey, nodeId, question.id)];
      if (!review) return question;
      return {
        ...question,
        status: review.status || question.status || "draft",
        quality: {
          ...(question.quality || {}),
          reviewerNote: review.note || question.quality?.reviewerNote || "",
        },
        reviewedAt: review.reviewedAt,
        reviewedBy: review.reviewedBy,
      };
    });
  }

  function questionsForUser(nodeId, routeKey, db, user) {
    const questions = applyQuestionReviews(getQuestionsForNode(nodeId, routeKey), db, routeKey, nodeId);
    if (user?.role === "teacher") return questions;
    return questions.filter((question) => question.status === "vetted");
  }

  function questionReviewSummary(db, routeKey = "primary") {
    const summary = {};
    const modules = routeData[routeKey]?.questionModules || {};
    for (const [moduleCode, nodes] of Object.entries(modules)) {
      for (const [nodeId, questions] of Object.entries(nodes)) {
        const reviewed = applyQuestionReviews(questions, db, routeKey, nodeId);
        const counts = { vetted: 0, draft: 0, hidden: 0, total: reviewed.length };
        reviewed.forEach((question) => {
          counts[question.status || "draft"] = (counts[question.status || "draft"] || 0) + 1;
        });
        summary[nodeId] = counts;
      }
      summary[moduleCode] ||= { totalNodes: Object.keys(nodes).length };
    }
    return summary;
  }

  return { applyQuestionReviews, questionReviewKey, questionReviewSummary, questionsForUser };
}
