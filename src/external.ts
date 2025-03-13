// @ts-nocheck

export function whenSubtitleOn() {
  console.log("[Debug] whenSubtitleOn function started");
  var script = [];
  var last_speaker = "";
  var lastProcessedText = "";
  var accumulatedText = "";
  var processingTimeout = null;
  var lastSentLength = 0; // Track the length of last sent transcript

  function processCaption(captionElement) {
    if (!captionElement) return;

    console.log("[Debug] Processing caption element:", captionElement.outerHTML);

    // Get the speaker name from the KcIKyf jxFHg class
    const speakerElement = document.querySelector(".KcIKyf.jxFHg");
    const speakerName = speakerElement ? speakerElement.textContent?.trim() : "Unknown Speaker";

    // Get the speaker container for profile picture (if needed)
    const speakerContainer =
      captionElement.closest("[data-participant-id]") || captionElement.closest("[data-self-name]");

    const currentText = captionElement.textContent?.trim();

    // Skip if this is the same text we just processed
    if (currentText === lastProcessedText) return;

    console.log("[Debug] New caption text from speaker:", speakerName, currentText);

    // Clear any pending timeout
    if (processingTimeout) {
      clearTimeout(processingTimeout);
    }

    // Accumulate text
    accumulatedText = currentText;

    // Wait for 2 seconds of no changes before processing
    processingTimeout = setTimeout(() => {
      if (accumulatedText && accumulatedText !== lastProcessedText) {
        console.log(
          "[Debug] Processing accumulated text from speaker:",
          speakerName,
          accumulatedText
        );

        const transribe = {
          speaker: {
            name: speakerName,
            profilePicture: speakerContainer?.querySelector("img")?.src || ""
          },
          text: accumulatedText,
          date: Date.now()
        };

        let shouldSendUpdate = false;

        if (last_speaker !== speakerName) {
          script.push(transribe);
          last_speaker = speakerName;
          shouldSendUpdate = true;
          console.log("[Debug] New speaker detected:", speakerName);
        } else {
          // Update the last entry if it's the same speaker
          if (script.length > 0) {
            const lastEntry = script[script.length - 1];
            // Only update if we have more content than before
            if (accumulatedText.length > lastEntry.text.length) {
              lastEntry.text = accumulatedText; // Replace with full text
              shouldSendUpdate = true;
              console.log("[Debug] Updated existing speaker's text with longer content");
            }
          }
        }

        // Only send update if we have new content and it's longer than what we sent before
        if (
          shouldSendUpdate &&
          script.length > 0 &&
          script[script.length - 1].text.length > lastSentLength
        ) {
          try {
            console.log("[Debug] Sending update with script:", JSON.stringify(script, null, 2));
            setTransribe(script, last_speaker);
            lastSentLength = script[script.length - 1].text.length;
            console.log("[Debug] Successfully called setTransribe with updated content");
            lastProcessedText = accumulatedText;
          } catch (error) {
            console.error("[Debug] Failed to call setTransribe:", error);
          }
        }
      }
    }, 2000); // Wait 2 seconds for the caption to stabilize
  }

  // Initial check for existing captions
  const existingCaptions = document.querySelectorAll('[jsname="tgaKEf"].bh44bd.VbkSUe');
  console.log("[Debug] Found existing caption elements:", existingCaptions.length);
  existingCaptions.forEach(processCaption);

  // Set up observer for the caption container
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // Check if this mutation is related to captions
      const captionElements = Array.from(mutation.addedNodes).filter(
        (node) =>
          node.nodeType === 1 && // Element node
          node.matches?.('[jsname="tgaKEf"].bh44bd.VbkSUe')
      );

      if (captionElements.length > 0) {
        console.log("[Debug] New caption elements detected:", captionElements.length);
        captionElements.forEach(processCaption);
      }

      // Also check for text changes in existing caption elements
      if (mutation.type === "characterData" || mutation.type === "childList") {
        const targetElement =
          mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;

        if (targetElement?.matches?.('[jsname="tgaKEf"].bh44bd.VbkSUe')) {
          processCaption(targetElement);
        }
      }
    });
  });

  // Start observing the entire document for caption changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  console.log("[Debug] Caption observer setup complete");
}
