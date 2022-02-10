import sparkMd5Min from './spark-md5.min.js';

const fileMap = {
  JPEG: "FF D8 FF E0",
  JPG: "FF D8 FF E1",
  PNG: "89 50 4E 47",
  GIF: "47 49 46 38",
  TIFF: "49 49 2A 00",
  BMP: "42 4D",
  DWG: "41 43 31 30",
  PSD: "38 42 50 53",
  RTF: "7B 5C 72 74 66",
  XML: "3C 3F 78 6D 6C",
  HTML: "68 74 6D 6C 3E",
  EML: "44 65 6C 69 76 65 72 79 2D 64 61 74 65 3A",
  DBX: "CF AD 12 FE C5 FD 74 6F",
  PST: "21 42 44 4E",
  XLS: "D0 CF 11 E0",
  DOC: "D0 CF 11 E0",
  MDB: "53 74 61 6E 64 61 72 64 20 4A",
  WPD: "FF 57 50 43",
  PDF: "25 50 44 46 2D 31 2E",
  QDF: "AC 9E BD 8F",
  PWL: "E3 82 85 96",
  ZIP: "50 4B 03 04",
  RAR: "52 61 72 21",
  WAV: "57 41 56 45",
  AVI: "41 56 49 20",
  RAM: "2E 72 61 FD",
  RM: "2E 52 4D 46",
  MPG: "00 00 01 BA",
  MPG: "00 00 01 B3",
  MOV: "6D 6F 6F 76",
  ASF: "30 26 B2 75 8E 66 CF 11",
  MID: "4D 54 68 64",
  MP3: "49 44 33",
}

const errorCode = {
  EMPTY_FILE: -1,
  UNMATCH_FILE_TYPE: -2
}

const fileContentType = {
  JPG: "image/jpeg",
  JPEG: "image/jpeg",
  PNG: "image/png",
  GIF: "image/gif",
  TIFF: "image/tiff",
  BMP: "image/bmp",
  DWG: "",
  PSD: "",
  RTF: "application/msword",
  XML: "text/xml",
  HTML: "text/html",
  EML: "message/rfc822",
  DBX: "",
  PST: "",
  XLS: "application/vnd.ms-excel",
  DOC: "application/msword",
  MDB: "application/msaccess",
  WPD: "",
  PDF: "application/pdf",
  QDF: "",
  PWL: "",
  ZIP: "application/x-zip-compressed",
  RAR: "",
  WAV: "audio/wav",
  AVI: "video/avi",
  RAM: "",
  RM: "",
  MPG: "audio/mpeg",
  MPG: "audio/mpeg",
  MOV: "video/quicktime",
  ASF: "video/x-ms-asf",
  MID: "audio/mid",
  MP3: "audio/mpeg",
  TXT: "text/plain"
}

const globalConfig = {
  // 默认不处理文件后缀与文件内容不符的情况
  ignoreUnmatchSuffix: true,
  // 默认不处理文件规格与设置不符的情况
  ingoreUnmatchSpec: true,
  // 是否根据文件内容修改文件后缀
  aotuFixSuffix: false,
  // 当前要处理的文件
  file: null,
  // 文件最大大小 默认100m
  fileMaxSize: 100 * 1024 * 1024,
  // 切片大小
  chunkSize: 0.5 * 1024 * 1024,
  // 是否计算整个文件的hash值
  exactHash: true
}

// 保证单独文件配置不能污染全局配置
function processConfig(config, isGlobal) {
  if(isGlobal) {
    return Object.assign(globalConfig, config);
  } else {
    return Object.assign(JSON.parse(JSON.stringify(globalConfig)), config);
  }
}

// 暴露一个全局设置的文件配置
export function setGlobalConfig(config) {
  processConfig(config, true); 
}

/**
 * 主函数，处理整个流程
 * @param { file } 文件blob信息
 * @param { config } 单独文件配置信息，会覆盖全局设置
 */
export async function processFile(file, config) {
  // 处理未传入配置的情况
  const result = config ? processConfig(config, false) : globalConfig;
  // 更新file信息
  result.file = file;

  const {isFileMatch, fileBinaryString} = await fileTypeMatch(file);
  console.log(isFileMatch);
  console.log(fileBinaryString)
  if(!fileBinaryString) {
    return { message: 'empty file', code: errorCode.EMPTY_FILE }
  }
  // ignoreUnmatchSuffix为false时就要说明要判断文件后缀与文件内容是否符合
  if(!result.ignoreUnmatchSuffix === false) {
    if(!isFileMatch) {
      if(result.aotuFixSuffix) {
        file = fileSuffixFix(file);
      } else {
        return { message: 'unmatch file type', code: errorCode.UNMATCH_FILE_TYPE };
      }
    }
  }

  return createFileChunks(file, result);
}

// 自动修复文件类型
export async function fileSuffixFix(file) {
  if(!file) file = globalConfig.file;

  const fileBlobString = await blobToBinaryString(file);
  const { filename } = getFileSuffix(file.name);
  for(let i in fileMap) {
    if(fileBlobString.includes(fileMap[i])) {
      return new File([file], filename + "." +  i.toLowerCase(), { type: fileContentType[i]});
    }
  }
  return file;
}

/**
 * 匹配文件后缀与文件内容是否相符
 * @param { file } 文件blob信息
 * 
 * @return
 * { isFileMatch } 文件内容与后缀是否匹配
 * { type } 根据文件内容获取的文件后缀
 * { fileBinaryString } 文件内容二进制
 */
export async function fileTypeMatch(file) {
  const suffix = (getFileSuffix(file.name).suffix.toUpperCase());
  const fileBinaryString = await blobToBinaryString(file);

  // 如果文件类型中没有该类型，默认为false
  if(suffix && !(suffix in fileMap)) {
    return {isFileMatch: false, type: suffix.toLowerCase()};
  }
  const fixFile = await fileSuffixFix(file);

  return { isFileMatch: fileBinaryString.includes(fileMap[suffix]), type: fixFile.type, fileBinaryString}
}

// 获取文件后缀
export function getFileSuffix(filename) {
  const regx = filename.match(/(\w+)(\.)(\w+)$/);
  if(regx) {
    return { filename: regx[1], suffix: regx[3] };
  }
  return { filename, suffix: '' };
}

// 将blob文件装成16进制
export async function blobToBinaryString(blob) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = function () {
      const ret = reader.result.split('') // 分隔开
        .map(v => v.charCodeAt()) // 循环返回指定位置的字符的 Unicode 编码
        .map(v => v.toString(16).toUpperCase()) // 返回十六进制格式
        .map(v => v.padStart(2, '0')) // 给空的那个填充 00 ，防止空缺
        .join(' ') // 每个子节之间空格隔开
      resolve(ret)
    }
    reader.readAsBinaryString(blob) // 调用之后触发onload事件
  })
}

// 文件切片
// 返回切片结果
export function createFileChunks(file, config = { chunkSize: globalConfig.chunkSize }) {
  const chunks = [];
  let currentChunk = 0;
  while(currentChunk < file.size) {
    chunks.push({index: currentChunk, chunk: file.slice(currentChunk, currentChunk + config.chunkSize) })
    currentChunk += config.chunkSize;
  }

  return chunks;
}

// 计算文件hash值
export async function calculateHash(file) {
  const blobString = await blobToBinaryString(file);
  return sparkMd5Min.hash(blobString);
}

// 对于大文件而言，计算hash太耗时； 抽样计算，hash一样的不一定是同一个文件
export async function calculateHashSample(file) {
  return new Promise(resolve => {
    const spark = new sparkMd5Min.ArrayBuffer();
    const reader = new FileReader();
    const offset = 2 * 1024 * 1024;
    const chunks = [file.slice(0, offset)];
    let currentChunk = offset;
    // 处理大于设定值的文件
    while(currentChunk < file.size) {
      // 对于大于设定值offset的文件的处理
      if(currentChunk + offset >= size) {
        chunks.push(file.slice(currentChunk, currentChunk + offset));
      } else {
        // 对于小于设定值offset的处理，
        const mid = currentChunk + offset / 2;
        const end = currentChunk + offset;
        chunks.push(file.slice(currentChunk, currentChunk + 2));
        chunks.push(file.slice(mid, mid + 2));
        chunks.push(file.slic(end - 2, end));
      }

      currentChunk += offset;
    }
    reader.readAsArrayBuffer(new Blob(chunks));

    reader.onload = e => {
      spark.append(e.target.result);
      resolve(spark.end());
    }
  })
}

// 扩展文件类型
export function extendsFileType(type, hash, fileContentType) {
  fileMap[type] = hash;
  fileContentType[type] = fileContentType;
}
