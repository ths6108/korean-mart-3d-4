export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { imageBase64, mediaType, objectType } = await req.json();

    const typeLabels = {
      shelf: '진열대', fridge: '냉장고', freezer: '냉동고',
      checkout: '계산대', floor: '바닥재', ceiling: '천장재'
    };
    const typeLabel = typeLabels[objectType] || objectType;

    const prompt = `이 사진은 한국 마트의 ${typeLabel}에 사용할 재질/소재 사진입니다.
사진을 분석해서 아래 JSON만 반환하세요 (마크다운, 설명 없이 JSON만):
{
  "material": "소재명 (예: 원목, 스테인리스, 타일, 유리, 플라스틱 등)",
  "mainColor": "주요 색상 hex (예: #C4A882)",
  "brightness": 밝기 조정 -80~80 정수 (어두운 사진이면 양수로 밝게, 과하게 밝으면 음수),
  "contrast": 대비 조정 -60~60 정수 (선명도 개선),
  "saturation": 채도 % 0~200 정수 (100=원본, 마트용으론 보통 90~120),
  "tileRepeat": 타일 반복 1~4 정수 (패턴·타일이면 2~4, 단색·사진이면 1),
  "sharpness": 선명도 강화 0~100 정수 (텍스처가 뚜렷해야 할 경우 높게),
  "description": "2문장 이내 한국어 소재 설명",
  "tags": ["태그1","태그2","태그3"],
  "recommendation": "이 소재를 ${typeLabel}에 사용할 때 특이사항 한 문장"
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'API error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    let rawText = data.content?.[0]?.text || '{}';
    rawText = rawText.replace(/```json|```/g, '').trim();

    let analysis;
    try {
      analysis = JSON.parse(rawText);
    } catch (e) {
      analysis = {
        material: '알 수 없음', mainColor: '#888888',
        brightness: 0, contrast: 10, saturation: 100,
        tileRepeat: 1, sharpness: 20,
        description: '소재를 분석했습니다.',
        tags: [objectType], recommendation: '적절하게 사용 가능합니다.'
      };
    }

    return new Response(JSON.stringify(analysis), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
