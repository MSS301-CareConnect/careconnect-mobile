// Caregiver absences (2026-11-10): missed visits the caregiver explains before the center concludes.
export const absenceCopy: Record<string, readonly [string, string]> = {
  absences: ['Vắng ca', 'Missed visits'],
  absencesHint: [
    'Buổi đã thanh toán mà bạn không check-in. Khách đã được hoàn 100 % tiền buổi đó. Hãy giải trình để trung tâm xem xét trước khi kết luận.',
    'Paid visits you did not check in to. The customer was refunded in full. Explain what happened so the center can review it before concluding.',
  ],
  absenceFilterPending: ['Chờ kết luận', 'Awaiting conclusion'],
  absenceFilterAll: ['Tất cả', 'All'],
  absencesEmptyPending: [
    'Không có lần vắng nào chờ kết luận.',
    'No missed visit awaits a conclusion.',
  ],
  absencesEmpty: ['Bạn chưa vắng ca lần nào.', 'You have not missed any visit.'],
  absenceVisit: ['Buổi {number}', 'Visit {number}'],
  absenceStatus_PENDING: ['Chờ kết luận', 'Awaiting conclusion'],
  absenceStatus_EXCUSED: ['Có lý do chính đáng', 'Excused'],
  absenceStatus_CONFIRMED: ['Vi phạm', 'Violation'],
  absenceSource_MISSED_CHECK_IN: ['Không check-in đúng hạn', 'No check-in in time'],
  absenceSource_NO_SHOW_REPORT_REJECTED: [
    'Trung tâm bác báo cáo khách vắng',
    'The center rejected your no-show report',
  ],
  absenceExplanation: ['Giải trình', 'Explanation'],
  absenceNoExplanation: ['Chưa có giải trình.', 'No explanation yet.'],
  absenceExplainedAt: ['Gửi lúc', 'Sent at'],
  absenceConclusion: ['Kết luận của trung tâm', 'Center conclusion'],
  absenceExplain: ['Gửi giải trình', 'Send explanation'],
  absenceEditExplanation: ['Sửa giải trình', 'Edit explanation'],
  absenceExplainTitle: ['Giải trình vắng ca', 'Explain a missed visit'],
  absenceExplainHint: [
    'Nêu rõ chuyện gì đã xảy ra. Bạn sửa được giải trình tới khi trung tâm kết luận.',
    'Say what happened. You can edit it until the center concludes.',
  ],
  absenceExplanationHint: ['Từ 10 đến 1000 ký tự.', '10 to 1000 characters.'],
  absenceExplanationShort: [
    'Giải trình cần ít nhất 10 ký tự.',
    'The explanation needs at least 10 characters.',
  ],
  absenceExplanationLong: ['Giải trình tối đa 1000 ký tự.', 'At most 1000 characters.'],
  absenceRefunded: [
    'Khách đã được hoàn 100 % tiền buổi này vào ví.',
    'The customer was refunded this visit in full to the wallet.',
  ],
  absenceAlreadyConcluded: [
    'Trung tâm đã kết luận lần vắng này, không sửa giải trình được nữa.',
    'The center already concluded this absence; the explanation can no longer change.',
  ],
  absenceSubmit: ['Gửi giải trình', 'Send explanation'],
  homeAbsencesPending: [
    'Bạn có {count} lần vắng ca cần giải trình',
    'You have {count} missed visits to explain',
  ],
  homeAbsencesOpen: ['Giải trình', 'Explain'],
};
