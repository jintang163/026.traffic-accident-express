function addWatermark(canvasId, imagePath, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      text = '',
      time = new Date().toLocaleString(),
      location = '',
      latitude,
      longitude,
      fontSize = 24,
      color = 'rgba(255, 255, 255, 0.85)',
      bgColor = 'rgba(0, 0, 0, 0.5)'
    } = options;

    console.log('[Watermark] 开始添加水印:', { imagePath, text, time, location });

    const query = wx.createSelectorQuery();
    query.select(`#${canvasId}`)
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) {
          reject(new Error('Canvas节点不存在'));
          return;
        }

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;

        wx.getImageInfo({
          src: imagePath,
          success: (imgInfo) => {
            const imgWidth = imgInfo.width;
            const imgHeight = imgInfo.height;
            
            canvas.width = imgWidth * dpr;
            canvas.height = imgHeight * dpr;
            ctx.scale(dpr, dpr);

            const img = canvas.createImage();
            img.onload = () => {
              ctx.drawImage(img, 0, 0, imgWidth, imgHeight);
              
              const lines = [];
              if (text) lines.push(text);
              lines.push(`时间: ${time}`);
              if (location) lines.push(`地点: ${location}`);
              if (latitude && longitude) {
                lines.push(`坐标: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
              }

              const lineHeight = fontSize + 8;
              const padding = 16;
              const textMaxWidth = lines.reduce((max, line) => {
                ctx.font = `${fontSize}px sans-serif`;
                const width = ctx.measureText(line).width;
                return Math.max(max, width);
              }, 0);

              const boxWidth = textMaxWidth + padding * 2;
              const boxHeight = lines.length * lineHeight + padding * 2;
              const boxX = 16;
              const boxY = imgHeight - boxHeight - 16;

              ctx.fillStyle = bgColor;
              ctx.beginPath();
              ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
              ctx.fill();

              ctx.fillStyle = color;
              ctx.font = `${fontSize}px sans-serif`;
              ctx.textBaseline = 'top';

              lines.forEach((line, index) => {
                ctx.fillText(line, boxX + padding, boxY + padding + index * lineHeight);
              });

              wx.canvasToTempFilePath({
                canvas: canvas,
                width: imgWidth,
                height: imgHeight,
                destWidth: imgWidth,
                destHeight: imgHeight,
                success: (result) => {
                  console.log('[Watermark] 水印添加成功:', result.tempFilePath);
                  resolve(result.tempFilePath);
                },
                fail: (err) => {
                  console.error('[Watermark] 导出图片失败:', err);
                  reject(err);
                }
              });
            };

            img.onerror = (err) => {
              console.error('[Watermark] 图片加载失败:', err);
              reject(err);
            };

            img.src = imagePath;
          },
          fail: (err) => {
            console.error('[Watermark] 获取图片信息失败:', err);
            reject(err);
          }
        });
      });
  });
}

function addWatermarks(canvasId, images, options = {}) {
  return new Promise(async (resolve, reject) => {
    const results = [];
    
    for (let i = 0; i < images.length; i++) {
      try {
        const result = await addWatermark(canvasId, images[i], {
          ...options,
          text: options.text ? `${options.text} (${i + 1}/${images.length})` : ''
        });
        results.push(result);
      } catch (err) {
        console.error('[Watermark] 批量添加水印失败:', err);
        reject(err);
        return;
      }
    }
    
    resolve(results);
  });
}

function formatDate(date) {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

module.exports = {
  addWatermark,
  addWatermarks,
  formatDate
};
