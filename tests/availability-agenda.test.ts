import { expect, test } from '@jest/globals';
import { agendaRows } from '../src/features/availability/agenda-model';
import { parseSchedule } from '../src/features/availability/models';
import { parseTimeOff } from '../src/features/availability/time-off';
import { parseVisit } from '../src/features/visits/models';

test('Vietnam day agenda clips multi-day time off at an exclusive end and keeps booked visits separate from availability', () => {
  const data = {
    schedules: [
      parseSchedule({
        id: 'slot',
        workDate: '2026-11-05',
        startTime: '08:00',
        endTime: '12:00',
        scheduleStatus: 'SCHEDULED',
        version: 1,
      }),
    ],
    visits: [
      parseVisit({
        id: 'visit',
        bookingId: 'booking',
        startAt: '2026-11-05T02:00:00Z',
        endAt: '2026-11-05T03:00:00Z',
        status: 'SCHEDULED',
      }),
      parseVisit({
        id: 'cancelled',
        bookingId: 'booking',
        startAt: '2026-11-05T03:00:00Z',
        endAt: '2026-11-05T04:00:00Z',
        status: 'CANCELLED',
      }),
    ],
    timeOffs: [
      parseTimeOff({
        id: 'off',
        caregiverId: 'caregiver',
        startAt: '2026-11-04T17:00:00Z',
        endAt: '2026-11-05T17:00:00Z',
        reason: '',
        version: 1,
      }),
    ],
  };
  const rows = agendaRows('2026-11-05', data);
  expect(rows.map((row) => row.kind)).toEqual(['timeOff', 'availability', 'visit']);
  expect(rows[0]).toMatchObject({
    start: Date.parse('2026-11-04T17:00:00Z'),
    end: Date.parse('2026-11-05T17:00:00Z'),
  });
  expect(agendaRows('2026-11-06', data)).toEqual([]);
});
