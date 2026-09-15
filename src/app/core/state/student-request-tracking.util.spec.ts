import {
  addTrackedRequestId,
  readTrackedRequestIds,
  writeTrackedRequestIds,
} from './student-request-tracking.util';

describe('student-request-tracking.util', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('reads an empty array when nothing was ever written', () => {
    expect(readTrackedRequestIds('s1', 'TranscriptRequest')).toEqual([]);
  });

  it('round-trips written ids', () => {
    writeTrackedRequestIds('s1', 'TranscriptRequest', ['r1', 'r2']);
    expect(readTrackedRequestIds('s1', 'TranscriptRequest')).toEqual(['r1', 'r2']);
  });

  it('keeps different students/request types isolated', () => {
    writeTrackedRequestIds('s1', 'TranscriptRequest', ['r1']);
    writeTrackedRequestIds('s1', 'IdReissue', ['r2']);
    writeTrackedRequestIds('s2', 'TranscriptRequest', ['r3']);

    expect(readTrackedRequestIds('s1', 'TranscriptRequest')).toEqual(['r1']);
    expect(readTrackedRequestIds('s1', 'IdReissue')).toEqual(['r2']);
    expect(readTrackedRequestIds('s2', 'TranscriptRequest')).toEqual(['r3']);
  });

  it('appends via addTrackedRequestId without clobbering existing ids', () => {
    addTrackedRequestId('s1', 'Grievance', 'r1');
    addTrackedRequestId('s1', 'Grievance', 'r2');
    expect(readTrackedRequestIds('s1', 'Grievance')).toEqual(['r1', 'r2']);
  });

  it('degrades to an empty array on malformed stored JSON', () => {
    localStorage.setItem('ums-student-web:student-requests:s1:TranscriptRequest', '{not json');
    expect(readTrackedRequestIds('s1', 'TranscriptRequest')).toEqual([]);
  });

  it('write is best-effort and never throws even if storage fails', () => {
    spyOn(localStorage, 'setItem').and.callFake(() => {
      throw new DOMException('quota exceeded');
    });
    expect(() => writeTrackedRequestIds('s1', 'TranscriptRequest', ['r1'])).not.toThrow();
  });
});
