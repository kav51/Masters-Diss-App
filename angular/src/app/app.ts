import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Prediction {
  label: string;
  score: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  text = '';
  status = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  predictions = signal<Prediction[]>([]);
  errorMessage = signal('');

  readonly backendUrl = 'http://127.0.0.1:8000/classify';

  async handleSubmit() {
    if (!this.text.trim()) return;

    this.status.set('loading');

    const startTime = performance.now();

    try {
      const response = await fetch(this.backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: this.text }),
      });

      if (!response.ok) {
        throw new Error(`Backend returned status ${response.status}`);
      }

      const data = await response.json();
      const endTime = performance.now();

      console.log(`Total round-trip time: ${(endTime - startTime).toFixed(1)}ms`);

      this.predictions.set(data.predictions);
      this.status.set('success');
    } catch (err: any) {
      this.errorMessage.set(err.message);
      this.status.set('error');
    }
  }

  formatScores(): string {
    return this.predictions()
      .map((p) => `${p.label}: ${(p.score * 100).toFixed(1)}%`)
      .join('  |  ');
  }
}