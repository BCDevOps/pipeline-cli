//
// pipeline-cli
//
// Copyright © 2019 Province of British Columbia
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

'use strict';

module.exports = class OpenShiftClientResult {
  constructor(proc) {
    this.proc = proc;

    this.stdOutHeaders = [];
    this.stdOutValues = [];
  }

  /**
   * Parses a raw stdOut string into separate strings (1 per std out line), and removes any that are empty.
   *
   * Example stdOut:
   *
   * ```
   *  'NAME                         REVISION   DESIRED   CURRENT   TRIGGERED BY\n' +
   *  'name-api-dev-78   4          1         0         config,image(name-api:dev-1.0.0-78)\n'
   * ```
   *
   * Example return:
   *
   * ```
   *  [
   *   'NAME                         REVISION   DESIRED   CURRENT   TRIGGERED BY',
   *   'name-api-dev-78   4          1         0         config,image(name-api:dev-1.0.0-78)'
   *  ]
   * ```
   *
   * @param {string[]} stdOut
   * @returns an array of non-empty strings
   */
  _getStdOutRows(stdOut) {
    if (!stdOut) {
      return [];
    }

    const rawRows = stdOut.split('\n');

    return rawRows.map(item => item.trim()).filter(item => item);
  }

  /**
   * Parses a string (presumed to be the first row of the expected std out) into an array of trimmed lowercase strings.
   *
   * Example stdOutString:
   *
   * ```
   *  'NAME                         REVISION   DESIRED   CURRENT   TRIGGERED BY'
   * ```
   *
   * Example return:
   *
   * ```
   *  ['name', 'revision', 'desired', 'current', 'triggered_by']
   * ```
   *
   * @param {string[]} stdOutString
   * @returns an array of header row values
   */
  _parseHeaderStdOutString(stdOutString) {
    if (!stdOutString) {
      return [];
    }

    return stdOutString
      .trim()
      .replace(/ {2,}/g, '|{}|')
      .split('|{}|')
      .map(item => item.toLowerCase().replace(/ +/g, '_'));
  }

  /**
   * Parses a string (presumed not to be the first row of the expected std out) into an array of trimmed strings.
   *
   * Example stdOutString:
   *
   * ```
   *  'name-api-dev-78   4          1         0         config,image(name-api:dev-1.0.0-78)'
   * ```
   *
   * Example return:
   *
   * ```
   *  ['name-api-dev-78', '4', '1', '0', 'config,image(name-api:dev-1.0.0-78)']
   * ```
   *
   * @param {string[]} stdOutString
   * @returns an array of row values
   */
  _parseValueStdOutString(stdOutString) {
    if (!stdOutString) {
      return [];
    }

    return stdOutString
      .trim()
      .replace(/ {2,}/g, '|{}|')
      .split('|{}|');
  }

  /**
   * Builds an object, where the object keys are the `stdOutHeaders` items, and the object values are the `stdOutValues`
   * items.
   *
   *
   * ### Example:
   *
   * Example stdOutHeaders:
   *
   * ```
   *  ['name', 'revision', 'desired', 'current', 'triggered_by']
   * ```
   *
   * Example stdOutValues:
   *
   * ```
   *  ['name-api-dev-78', '4', '1', '0', 'config,image(name-api:dev-1.0.0-78)']
   * ```
   *
   * Example return:
   *
   * ```
   *  {
   *    name: 'name-api-dev-78',
   *    revision: '4',
   *    desired: '1',
   *    current: '0',
   *    triggered_by: 'config,image(name-api:dev-1.0.0-78)'
   *  }
   * ```
   *
   * @param {*} stdOutHeaders array of header values
   * @param {*} stdOutValues array of values
   * @returns an object, where the keys are the header values
   */
  _buildStdOutObject(stdOutHeaders, stdOutValues) {
    if (!stdOutHeaders || !stdOutHeaders.length || !stdOutValues || !stdOutValues.length) {
      return {};
    }

    const stdOutObject = {};

    stdOutHeaders.forEach((header, index) => {
      stdOutObject[header] = stdOutValues[index];
    });

    return stdOutObject;
  }

  /**
   * Parses the raw process std out data into an object.
   *
   * @param {string} stdOutData
   * @returns {object}
   */
  _parseProcessStdOutDataIntoObject(stdOutData) {
    let stdOut = stdOutData.toString();

    const stdOutRows = this._getStdOutRows(stdOut);

    if (!stdOutRows.length) {
      return {};
    }

    if (!this.stdOutHeaders.length) {
      // Processing the first non-empty std out message received, parse the first row as the header row
      this.stdOutHeaders = this._parseHeaderStdOutString(stdOutRows[0]);

      if (stdOutRows[1]) {
        // If present, parse a subsequent std out value row
        this.stdOutValues = this._parseValueStdOutString(stdOutRows[1]);
      }
    } else {
      // Parse a subsequent std out value row
      this.stdOutValues = this._parseValueStdOutString(stdOutRows[0]);
    }

    // If both header and value rows were parsed, combine into an object, where the header row values are the keys
    return this._buildStdOutObject(this.stdOutHeaders, this.stdOutValues);
  }

  /**
   * Determines if a deployment is complete based on the properties of the `stdOutObject`.
   * A deployment is considered complete if the current # of replicas equals the desired # of replicas.
   *
   * @param {object} stdOutObject
   * @returns {boolean} `true` if the process is complete, `false` otherwise.
   */
  _isDeploymentComplete(stdOutObject) {
    // Object is still missing expected values
    if (!stdOutObject || !stdOutObject.desired || !stdOutObject.current) {
      return false;
    }

    if (stdOutObject.desired === stdOutObject.current) {
      return true;
    }

    return false;
  }

  /**
   * Waits for a deployment from the oc get dc --wait command.
   *
   * It will kill the process once the desired replicas and current replicas are equal.
   *
   * Example:
   *
   * ```
   *  const proc = self.rawAsync('get', 'dc', {
   *   selector: `app=${appName}`,
   *   watch: 'true'
   *  });
   *
   *  const openShiftClientResult = new OpenShiftClientResult(proc);
   *  openShiftClientResult.waitForDeployment();
   *  // proc will kill when replicas match desired amount
   *
   *  proc.on('exit', () => do something here)
   * ```
   */
  waitForDeployment() {
    if (!this.proc) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`WAITING FOR DEPLOYMENT:
      If a deployment fails, it will not throw. 
      Ensure you are setting appropriate timeouts while using this implementation!
    `);

    this.proc.stdout.on('data', data => {
      // Kill the child process if the current # of replicas is equal to the desired # of replicas (job is complete)
      if (this._isDeploymentComplete(this._parseProcessStdOutDataIntoObject(data))) {
        this.proc.kill('SIGTERM');
      }
    });
  }
};
