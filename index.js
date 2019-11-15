#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const fontCarrier = require('font-carrier');
const _ = require('lodash');
const fontBlast = require('font-blast')
const svg2img = require('svg2img');
const util = require('util');
// const tesseract = require('tesseractocr');
const readdirp = require('readdirp');
const pLimit = require('p-limit');
const makeDir = require('make-dir');
const Tesseract = require('tesseract.js');
const _cliProgress = require('cli-progress');
const _colors = require('colors');

const readFileAsync = util.promisify(fs.readFile);
const svg2imgAsync = util.promisify(svg2img);
const writeFileAsync = util.promisify(fs.writeFile);



async function delay(time = 1000) {
  return new Promise(r => {
    setTimeout(r, time);
  })
}

async function genOutDir() {
  const OUTPUT = 'dist';
  const pathDir = await makeDir(OUTPUT);
  return pathDir;
}

async function genSvg(file, color = '#000') {
  const { name } = path.parse(file);
  const outdir = await genOutDir();
  const outFile = path.join(outdir, `${name}.svg`);
  const transFont = fontCarrier.transfer(file);
  await writeFileAsync(outFile, transFont.toString())
  fontBlast(outFile, name);
  const files = await readdirp.promise(`${name}/svg`, { fileFilter: '*.svg' });
  const limit = pLimit(3);
  const results = await Promise.all(files.map(fStat =>
    limit(() =>
      readFileAsync(fStat.fullPath, 'utf8')
        .then(str => {
          const fixStr = str.replace(/viewBox=\"0 0 1000 1000\"/, 'viewBox=\"-300 100 1500 1500\"').replace(/\<path/, `<path fill="${color}"`)
          fs.writeFileSync(fStat.fullPath, fixStr)
          return fStat
        })
    )
  ));
  return results
}

async function transFont(file = './font_926539_x9cng5u1o6m/8ed29038.woff', format = 'png') {
  const files = await genSvg(file);
  const limit = pLimit(5);
  const { name } = path.parse(file);
  const baseDir = `${name}/${format}`;
  const pathDir = await makeDir(baseDir);
  const results = await Promise.all(files.map(fStat => 
    limit(() => 
      svg2imgAsync(fStat.fullPath, { format, })
        .then(buffer => {
          const filename = path.join(pathDir, fStat.basename.replace(/svg$/, format));
          fs.writeFileSync(filename, buffer)
          return filename
        })
    )
    ));
  console.log('transFont done');
  return results;
}

async function imageToStr(files = [], fontFile) {
  // const list = await tesseract.listLanguages();
  const b1 = new _cliProgress.SingleBar({
    format: 'imageToStr Progress |' + _colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Chunks',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  b1.start(files.length, 0, {
    speed: "N/A"
  });
  const worker = Tesseract.createWorker();
  await worker.load();
  await worker.loadLanguage('chi_sim');
  await worker.initialize('chi_sim');
  const limit = pLimit(1);
  const result = {};
  const outdir = await genOutDir();
  const outFile = path.join(outdir, `${path.parse(fontFile).name}.json`);
  await Promise.all(files.map(file => limit(() => worker.recognize(file).then(({ data: { text } }) => {
    const { name } = path.parse(file);
    result[name] = text.trim();
    b1.increment();
  })))).catch(error => {
    fs.writeFileSync(outFile, JSON.stringify(result));
    throw error;
  });
  await worker.terminate();
  b1.stop();
  fs.writeFileSync(outFile, JSON.stringify(result));
  console.log(result);
}
/* 废弃 */
async function imageToText(files = [], fontFile) {
  // const list = await tesseract.listLanguages();
  const b1 = new _cliProgress.SingleBar({
    format: 'imageToText Progress |' + _colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Chunks',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  b1.start(files.length, 0, {
    speed: "N/A"
  });
  const recognize = tesseract.withOptions({
    language: ['chi_sim']
  });
  const limit = pLimit(5);
  const result = {};
  const outdir = await genOutDir();
  const outFile = path.join(outdir, `${path.parse(fontFile).name}.json`);
  await Promise.all(files.slice.map(file => limit(() => recognize(file).then(text => {
    const { name } = path.parse(file);
    result[name] = text.replace();
    b1.increment();
  })))).catch(error => {
    fs.writeFileSync(outFile, JSON.stringify(result));
    console.log(result);
  });
  b1.stop();
  fs.writeFileSync(outFile, JSON.stringify(result));
  console.log(result);
}

async function init(file = './font_926539_x9cng5u1o6m/8ed29038.woff') {
  const files = await transFont(file);
  await imageToStr(files, file)
}
// 只转化图片
// transFont('./font_926539_x9cng5u1o6m/8ed29038.woff', 'png')

// 转化图片 且 尝试node 文字提取
init('./font_926539_x9cng5u1o6m/8ed29038.woff')
