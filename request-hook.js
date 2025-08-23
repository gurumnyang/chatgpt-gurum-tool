(() => {
  const OriginalRequest = window.Request;

  // 프록시 패턴을 사용하여 원래의 Request 생성자 바인딩 유지
  window.Request = function(input, init) {
    try {
      const url = (typeof input === "string" ? input : input?.url) || "";
      const body = init?.body;

      if (url.includes("/conversation/init")) {
        console.log("📡 [Request Hook] INIT 요청 감지됨:");
        console.log("🌐 URL:", url);

        // 본문 데이터 처리
        if (typeof body === "string") {
          try {
            const bodyObj = JSON.parse(body);
            console.log("📝 Body (parsed):", bodyObj);
            
            // window.postMessage로 content script로 데이터 전송
            window.postMessage({ 
              type: "CHATGPT_TOOL_INIT_REQUEST", 
              url: url,
              body: bodyObj,
              keepalive: init?.keepalive
            }, "*");
          } catch (e) {
            console.log("📝 Body (string):", body);
          }
        } else if (body instanceof Blob) {
          // Blob은 비동기적으로 처리
          body.text().then(text => {
            console.log("📝 Body (Blob):", text);
            try {
              const bodyObj = JSON.parse(text);
              window.postMessage({ 
                type: "CHATGPT_TOOL_INIT_REQUEST", 
                url: url,
                body: bodyObj,
                keepalive: init?.keepalive
              }, "*");
            } catch(e) {
              console.warn("Blob 파싱 에러:", e);
            }
          });
        } else if (body instanceof FormData) {
          const obj = {};
          for (const [key, val] of body.entries()) obj[key] = val;
          // Body (FormData)
        } else {
          // Body (기타)
        }
      }
    } catch (err) {
      console.warn("Request 후킹 중 에러:", err);
    }

    // 원래의 Request 생성자를 호출하되, this 바인딩 유지
    // apply/call을 사용하지 않고 new 연산자 사용
    return new OriginalRequest(input, init);
  };

  // 프로토타입과 생성자 속성 유지
  window.Request.prototype = OriginalRequest.prototype;
  window.Request.prototype.constructor = window.Request;

  console.log("✅ [후킹 완료] Request 생성자 감시 중...");
})();
