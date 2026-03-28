const PING_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

export const playNotificationSound = () => {
  try {
    const audio = new Audio(PING_URL);
    audio.play().catch(e => console.error("Sound play blocked by browser:", e));
  } catch (err) {
    console.error("Audio API not supported or error:", err);
  }
};
