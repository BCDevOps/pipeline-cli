'use strict';

const expect = require('expect');
const OpenShiftClientResult = require('../lib/OpenShiftClientResult');

describe('OpenShiftClientResult', () => {
  const procStub = {};

  describe('_getStdOutRows', () => {
    describe('returns an empty array', () => {
      it('when stdOut is undefined', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._getStdOutRows(undefined);
        expect(result).toEqual([]);
      });

      it('when stdOut is null', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._getStdOutRows(null);
        expect(result).toEqual([]);
      });

      it('when stdOut is empty', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._getStdOutRows('');
        expect(result).toEqual([]);
      });
    });

    describe('returns an array', () => {
      it('when stdOut has 1 line', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._getStdOutRows('this is a line');
        expect(result).toEqual(['this is a line']);
      });

      it('when stdOut has 2 lines', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._getStdOutRows('this is line 1\nthis is line 2');
        expect(result).toEqual(['this is line 1', 'this is line 2']);
      });

      it('when stdOut has 3 lines', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._getStdOutRows(
          'this is line 1\nthis is line 2\nthis is line 3',
        );
        expect(result).toEqual(['this is line 1', 'this is line 2', 'this is line 3']);
      });

      it('when stdOut has empty lines', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._getStdOutRows(
          'this is line 1\n\n\n\n\nthis is line 3',
        );
        expect(result).toEqual(['this is line 1', 'this is line 3']);
      });

      it('when stdOut has extra whitespace lines', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._getStdOutRows(
          '    this is line 1   \n\n    \n   \n\n   this is line 3    ',
        );
        expect(result).toEqual(['this is line 1', 'this is line 3']);
      });
    });
  });

  describe('_parseHeaderStdOutString', () => {
    describe('returns an empty array', () => {
      it('when stdOut is undefined', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._parseHeaderStdOutString(undefined);
        expect(result).toEqual([]);
      });

      it('when stdOut is null', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._parseHeaderStdOutString(null);
        expect(result).toEqual([]);
      });

      it('when stdOut is empty', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._parseHeaderStdOutString('');
        expect(result).toEqual([]);
      });
    });

    describe('returns an array', () => {
      it('when stdOut has 3 headers of mixed case with extra whitespace and underscores', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._parseHeaderStdOutString(
          '   HEADER1          header2    HEADER 3   Header_4   ',
        );
        expect(result).toEqual(['header1', 'header2', 'header_3', 'header_4']);
      });
    });
  });

  describe('_parseValueStdOutString', () => {
    describe('returns an empty array', () => {
      it('when stdOut is undefined', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._parseValueStdOutString(undefined);
        expect(result).toEqual([]);
      });

      it('when stdOut is null', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._parseValueStdOutString(null);
        expect(result).toEqual([]);
      });

      it('when stdOut is empty', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._parseValueStdOutString('');
        expect(result).toEqual([]);
      });
    });

    describe('returns an array', () => {
      it('when stdOut is a string with extra whitespace', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._parseValueStdOutString('    this is a line    ');
        expect(result).toEqual(['this is a line']);
      });
    });
  });

  describe('_buildStdOutObject', () => {
    describe('returns an empty object', () => {
      it('when stdOutHeaders is undefined', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._buildStdOutObject(undefined, ['valid']);
        expect(result).toEqual({});
      });

      it('when stdOutHeaders is null', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._buildStdOutObject(null, ['valid']);
        expect(result).toEqual({});
      });

      it('when stdOutHeaders length is 0', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._buildStdOutObject([], ['valid']);
        expect(result).toEqual({});
      });

      it('when stdOutValues is undefined', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._buildStdOutObject(['valid'], undefined);
        expect(result).toEqual({});
      });

      it('when stdOutValues is null', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._buildStdOutObject(['valid'], null);
        expect(result).toEqual({});
      });

      it('when stdOutValues length is 0', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._buildStdOutObject(['valid'], []);
        expect(result).toEqual({});
      });
    });

    describe('returns an object', () => {
      it('when stdOutHeaders and stdOutValues are valid and the same length', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._buildStdOutObject(
          ['header1', 'header2'],
          ['value1', 'value2'],
        );
        expect(result).toEqual({ header1: 'value1', header2: 'value2' });
      });

      it('when stdOutHeaders and stdOutValues are valid but stdOutHeaders has extra items', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._buildStdOutObject(
          ['header1', 'header2', 'header3'],
          ['value1', 'value2'],
        );
        expect(result).toEqual({ header1: 'value1', header2: 'value2', header3: undefined });
      });

      it('when stdOutHeaders and stdOutValues are valid but stdOutValues has extra items', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._buildStdOutObject(
          ['header1', 'header2'],
          ['value1', 'value2'],
        );
        expect(result).toEqual({ header1: 'value1', header2: 'value2' });
      });
    });
  });

  describe('_parseProcessStdOutDataIntoObject', () => {
    it('when stdOut is empty', () => {
      const openShiftClientResult = new OpenShiftClientResult(procStub);
      const result = openShiftClientResult._parseProcessStdOutDataIntoObject('');
      expect(result).toEqual({});
    });

    it('when stdOut has 1 line initially', () => {
      const openShiftClientResult = new OpenShiftClientResult(procStub);
      const result1 = openShiftClientResult._parseProcessStdOutDataIntoObject(
        'header1  header2  header3\n',
      );
      expect(result1).toEqual({});

      const result2 = openShiftClientResult._parseProcessStdOutDataIntoObject(
        'value1  value2  value3\n',
      );
      expect(result2).toEqual({ header1: 'value1', header2: 'value2', header3: 'value3' });
    });

    it('when stdOut has 2 lines initially', () => {
      const openShiftClientResult = new OpenShiftClientResult(procStub);
      const result = openShiftClientResult._parseProcessStdOutDataIntoObject(
        'header1  header2  header3\nvalue1  value2  value3',
      );
      expect(result).toEqual({ header1: 'value1', header2: 'value2', header3: 'value3' });
    });

    it('when stdOut has 1 line initially and receives empty subsequent lines', () => {
      const openShiftClientResult = new OpenShiftClientResult(procStub);
      const result1 = openShiftClientResult._parseProcessStdOutDataIntoObject(
        'header1  header2  header3\n',
      );
      expect(result1).toEqual({});

      const result2 = openShiftClientResult._parseProcessStdOutDataIntoObject('\n      \n   \n');
      expect(result2).toEqual({});

      const result3 = openShiftClientResult._parseProcessStdOutDataIntoObject(
        'value1  value2  value3\n',
      );
      expect(result3).toEqual({ header1: 'value1', header2: 'value2', header3: 'value3' });
    });
  });

  describe('_isDeploymentComplete', () => {
    describe('returns false', () => {
      it('when stdOutObject is undefined', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._isDeploymentComplete(undefined);
        expect(result).toEqual(false);
      });

      it('when stdOutObject is null', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._isDeploymentComplete(null);
        expect(result).toEqual(false);
      });

      it('when stdOutObject is empty', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._isDeploymentComplete({});
        expect(result).toEqual(false);
      });

      it('is missing `desired` property', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._isDeploymentComplete({ current: 1 });
        expect(result).toEqual(false);
      });

      it('is missing `current` property', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._isDeploymentComplete({ desired: 1 });
        expect(result).toEqual(false);
      });

      it('`desired` and `current` properties do not match', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._isDeploymentComplete({ current: 0, desired: 1 });
        expect(result).toEqual(false);
      });
    });

    describe('returns true', () => {
      it('`desired` and `current` properties match', () => {
        const openShiftClientResult = new OpenShiftClientResult(procStub);
        const result = openShiftClientResult._isDeploymentComplete({ current: 1, desired: 1 });
        expect(result).toEqual(true);
      });
    });
  });
});
