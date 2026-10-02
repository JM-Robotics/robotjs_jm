#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const candidateValue = process.argv[2];
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function parse(value) {
  const match = semverPattern.exec(value);
  if (!match) return null;
  return {
    value,
    core: match.slice(1, 4).map(Number),
    prerelease: match[4] === undefined ? null : match[4].split('.'),
  };
}

function compare(left, right) {
  for (let index = 0; index < left.core.length; index += 1) {
    if (left.core[index] !== right.core[index]) return Math.sign(left.core[index] - right.core[index]);
  }
  if (left.prerelease === null || right.prerelease === null) {
    return left.prerelease === right.prerelease ? 0 : left.prerelease === null ? 1 : -1;
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined || rightPart === undefined) return leftPart === undefined ? -1 : 1;
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) return Math.sign(Number(leftPart) - Number(rightPart));
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

const candidate = parse(candidateValue || '');
if (!candidate) {
  console.error(`Invalid package version '${candidateValue || ''}'; expected SemVer.`);
  process.exit(1);
}

let publishedValues;
try {
  const parsedInput = JSON.parse(fs.readFileSync(0, 'utf8'));
  publishedValues = Array.isArray(parsedInput) ? parsedInput : [parsedInput];
} catch (error) {
  console.error(`Could not parse published npm versions: ${error.message}`);
  process.exit(1);
}

const published = publishedValues.map((value) => parse(value));
if (published.length === 0 || published.some((version) => version === null)) {
  console.error('npm returned no versions or an invalid version.');
  process.exit(1);
}

const latest = published.reduce((left, right) => compare(left, right) >= 0 ? left : right);
if (compare(candidate, latest) <= 0) {
  console.error(`Package version '${candidate.value}' must be greater than the latest published npm version '${latest.value}'.`);
  process.exit(1);
}

console.log(`Package version ${candidate.value} is newer than published npm version ${latest.value}.`);
