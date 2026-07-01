# VisionQuest AI - Local Multi-Purpose Object Detection

A high-performance, 100% offline, privacy-centric object detection dashboard and telemetry terminal running entirely inside the user's browser. Powered by **TensorFlow.js** and the **full MobileNetV2 COCO-SSD model**.

---

## 🌟 Key Features

*   **100% Local Inference**: Zero cloud calls, zero latency spikes, and zero API cost. Detections operate on CPU/GPU cycles directly on the client.
*   **Highly Accurate Predictions**: Loaded using the full MobileNetV2 base weights for stable classification and premium boundary coordinates.
*   **Sleek HUD Overlay & Telemetry Grid**: Displays real-time latency (ms), frame FPS, and detected target indicators.
*   **Interactive Control Center Dock**:
    *   **Hot-Swappable Webcams**: Instantly switch active video streams.
    *   **Inference Freeze**: Pause/Resume model evaluations while keeping the camera live.
    *   **Voice Announcement Toggle**: Audio speech alerts throttled to prevent narrator spam.
    *   **HUD Snapshot Exporter (PNG)**: Merges stream pixels and canvas target overlays to export high-res captures.
    *   **JSON Event Log Export**: Downloads chronological session history.
*   **Tailored Application Modes**:
    *   **General**: Daily desktop/living workspace scanning.
    *   **Retail/Inventory**: Counts shelves and highlights low-stock alerts.
    *   **Security/Surveillance**: Identifies suspicious bags or targets in zone sectors.
    *   **Accessibility**: Provides directional guides and layout voice assistance.
    *   **Educational**: Identifies books, cups, and learning devices.

---

## 🚀 Setup & Run Locally

### Prerequisites
*   Node.js (v18 or higher recommended)
*   Webcam device connected to your machine

### Steps
1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Start development server**:
    ```bash
    npm run dev
    ```

3.  **Open in browser**:
    Navigate to **http://localhost:3000** (Webcams require a secure context like `localhost` or `https://` to authorize media capture).
