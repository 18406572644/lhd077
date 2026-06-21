import type { RetrievalParams } from '../../shared/types.js';
import { LogRepo } from '../data/repositories.js';

export const MAX_QUESTION_LENGTH = 2000;
export const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;

export interface ValidationError {
  code: string;
  message: string;
  affectedScope: string;
  recoverable: boolean;
}

export function validateRetrievalParams(params: Partial<RetrievalParams>): ValidationError | null {
  if (params.topK !== undefined) {
    if (typeof params.topK !== 'number' || params.topK < 1 || params.topK > 50) {
      LogRepo.create({
        level: 'error',
        category: 'qa',
        message: `非法参数 topK=${params.topK}，必须在 1-50 之间`,
        affectedScope: '当前问答请求',
        recoverable: true,
      });
      return {
        code: 'INVALID_TOPK',
        message: 'topK 必须是 1 到 50 之间的整数',
        affectedScope: '当前问答请求，参数已被重置为默认值',
        recoverable: true,
      };
    }
  }
  if (params.minScore !== undefined) {
    if (typeof params.minScore !== 'number' || params.minScore < 0 || params.minScore > 1) {
      LogRepo.create({
        level: 'error',
        category: 'qa',
        message: `非法参数 minScore=${params.minScore}，必须在 0-1 之间`,
        affectedScope: '当前问答请求',
        recoverable: true,
      });
      return {
        code: 'INVALID_MINSCORE',
        message: 'minScore 必须是 0 到 1 之间的数字',
        affectedScope: '当前问答请求，参数已被重置为默认值',
        recoverable: true,
      };
    }
  }
  if (params.chunkSize !== undefined) {
    if (typeof params.chunkSize !== 'number' || params.chunkSize < 50 || params.chunkSize > 2000) {
      LogRepo.create({
        level: 'error',
        category: 'import',
        message: `非法参数 chunkSize=${params.chunkSize}，必须在 50-2000 之间`,
        affectedScope: '文档切分操作',
        recoverable: true,
      });
      return {
        code: 'INVALID_CHUNKSIZE',
        message: 'chunkSize 必须是 50 到 2000 之间的整数',
        affectedScope: '文档切分操作，参数已被重置为默认值',
        recoverable: true,
      };
    }
  }
  if (params.chunkOverlap !== undefined) {
    if (typeof params.chunkOverlap !== 'number' || params.chunkOverlap < 0 || params.chunkOverlap > 500) {
      LogRepo.create({
        level: 'error',
        category: 'import',
        message: `非法参数 chunkOverlap=${params.chunkOverlap}，必须在 0-500 之间`,
        affectedScope: '文档切分操作',
        recoverable: true,
      });
      return {
        code: 'INVALID_CHUNKOVERLAP',
        message: 'chunkOverlap 必须是 0 到 500 之间的整数',
        affectedScope: '文档切分操作，参数已被重置为默认值',
        recoverable: true,
      };
    }
  }
  return null;
}

export function validateQuestion(question: string): ValidationError | null {
  if (!question || !question.trim()) {
    LogRepo.create({
      level: 'warn',
      category: 'qa',
      message: '空问题被拒绝',
      affectedScope: '当前问答请求',
      recoverable: true,
    });
    return {
      code: 'EMPTY_QUESTION',
      message: '问题不能为空',
      affectedScope: '当前问答请求',
      recoverable: true,
    };
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    LogRepo.create({
      level: 'warn',
      category: 'qa',
      message: `超长问题（${question.length}字符）被截断`,
      affectedScope: '当前问答请求，问题将被截断',
      recoverable: true,
    });
    return {
      code: 'QUESTION_TOO_LONG',
      message: `问题长度超过最大限制 ${MAX_QUESTION_LENGTH} 字符，已被截断`,
      affectedScope: '当前问答请求，问题前 2000 字符有效',
      recoverable: true,
    };
  }
  return null;
}

export function validateDocumentContent(
  filename: string,
  content: string,
): ValidationError | null {
  if (!content || !content.trim()) {
    LogRepo.create({
      level: 'warn',
      category: 'import',
      message: `空文档被跳过：${filename}`,
      affectedScope: `文件 ${filename} 未被导入`,
      recoverable: true,
    });
    return {
      code: 'EMPTY_DOCUMENT',
      message: `文档 ${filename} 内容为空，已跳过`,
      affectedScope: `文件 ${filename}`,
      recoverable: true,
    };
  }
  if (content.length > MAX_DOCUMENT_SIZE) {
    LogRepo.create({
      level: 'warn',
      category: 'import',
      message: `文档过大被跳过：${filename}（${content.length}字节）`,
      affectedScope: `文件 ${filename} 未被导入`,
      recoverable: true,
    });
    return {
      code: 'DOCUMENT_TOO_LARGE',
      message: `文档 ${filename} 超过最大限制 ${MAX_DOCUMENT_SIZE} 字节`,
      affectedScope: `文件 ${filename}`,
      recoverable: true,
    };
  }
  return null;
}

export function sanitizeRetrievalParams(params: Partial<RetrievalParams>): RetrievalParams {
  return {
    topK: typeof params.topK === 'number' && params.topK >= 1 && params.topK <= 50 ? params.topK : 5,
    minScore:
      typeof params.minScore === 'number' && params.minScore >= 0 && params.minScore <= 1
        ? params.minScore
        : 0.1,
    chunkSize:
      typeof params.chunkSize === 'number' && params.chunkSize >= 50 && params.chunkSize <= 2000
        ? params.chunkSize
        : 300,
    chunkOverlap:
      typeof params.chunkOverlap === 'number' && params.chunkOverlap >= 0 && params.chunkOverlap <= 500
        ? params.chunkOverlap
        : 50,
    useBM25: typeof params.useBM25 === 'boolean' ? params.useBM25 : true,
  };
}
