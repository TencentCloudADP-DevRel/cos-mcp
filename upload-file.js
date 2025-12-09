import fs from 'fs';
import path from 'path';
import COS from 'cos-nodejs-sdk-v5';
import dotenv from 'dotenv';

dotenv.config();

const cos = new COS({
  SecretId: process.env.SecretId,
  SecretKey: process.env.SecretKey,
});

const bucket = process.env.Bucket;
const region = process.env.Region;

async function uploadFile(localFilePath, targetKey) {
  try {
    if (!fs.existsSync(localFilePath)) {
      console.error('文件不存在:', localFilePath);
      return;
    }
    
    const stats = fs.statSync(localFilePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`文件: ${path.basename(localFilePath)}`);
    console.log(`大小: ${sizeMB} MB`);
    console.log('开始上传...\n');
    
    // 根据文件大小选择上传方法
    let result;
    if (stats.size < 5 * 1024 * 1024) {
      // 小于 5MB，使用 putObject
      const fileContent = fs.readFileSync(localFilePath);
      result = await cos.putObject({
        Bucket: bucket,
        Region: region,
        Key: targetKey,
        Body: fileContent,
      });
    } else {
      // 大于 5MB，使用分片上传
      result = await new Promise((resolve, reject) => {
        cos.uploadFile({
          Bucket: bucket,
          Region: region,
          Key: targetKey,
          FilePath: localFilePath,
          SliceSize: 1024 * 1024 * 5, // 5MB 分片
          onProgress: (progressData) => {
            process.stdout.write(`\r上传进度: ${(progressData.percent * 100).toFixed(2)}%`);
          }
        }, (err, data) => {
          if (err) reject(err);
          else {
            console.log(''); // 换行
            resolve(data);
          }
        });
      });
    }
    
    console.log('✅ 上传成功!');
    console.log(`Location: ${result.Location}\n`);
    
    // 获取访问URL
    cos.getObjectUrl({
      Bucket: bucket,
      Region: region,
      Key: targetKey,
      Sign: true
    }, (err, data) => {
      if (err) {
        console.error('获取URL失败:', err);
      } else {
        console.log('🔗 访问URL (有效期15分钟):');
        console.log(data.Url);
      }
    });
    
  } catch (error) {
    console.error('❌ 上传失败:', error);
    process.exit(1);
  }
}

// 从命令行参数获取文件路径
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('用法: node upload-file.js <本地文件路径> [COS目标路径]');
  console.log('示例: node upload-file.js /path/to/file.txt');
  console.log('示例: node upload-file.js /path/to/file.txt mydir/file.txt');
  process.exit(1);
}

const localPath = args[0];
const targetPath = args[1] || path.basename(localPath);

uploadFile(localPath, targetPath);
