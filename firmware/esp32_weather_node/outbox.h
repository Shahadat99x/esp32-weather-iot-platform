#ifndef OUTBOX_H
#define OUTBOX_H

#include <Arduino.h>
#include "config.h"

// Simple Ring Buffer for JSON Strings
// Note: Storing Strings in memory can be fragment-heavy, 
// but for < 50 items on ESP32 it's usually acceptable if payloads are small (~200 bytes).
// OUTBOX_MAX * 200 bytes ~= 10KB. ESP32 has ~520KB RAM. Safe.

class Outbox {
  private:
    String buffer[OUTBOX_MAX];
    int head; // Points to the next write slot
    int tail; // Points to the next read slot
    int count;

  public:
    Outbox() {
      head = 0;
      tail = 0;
      count = 0;
    }

    bool isFull() {
      return count >= OUTBOX_MAX;
    }

    bool isEmpty() {
      return count == 0;
    }

    int size() {
      return count;
    }

    bool push(String payload) {
      if (isFull()) {
        return false; // Buffer full
      }
      buffer[head] = payload;
      head = (head + 1) % OUTBOX_MAX;
      count++;
      return true;
    }

    String pop() {
      if (isEmpty()) {
        return "";
      }
      String payload = buffer[tail];
      // buffer[tail] = ""; // Optional: Clear to free memory, but overwriting is faster if using fixed arrays? 
                            // With Arduino String, assigning "" frees the heap buffer.
      buffer[tail] = ""; 
      tail = (tail + 1) % OUTBOX_MAX;
      count--;
      return payload;
    }

    String peek() {
      if (isEmpty()) {
        return "";
      }
      return buffer[tail];
    }
    
    // Drop the oldest item to make space (Circular overwrite logic usually does this)
    // But here we might want explicit "drop oldest" if we need to force space
    void dropOldest() {
      if (!isEmpty()) {
        pop();
      }
    }
};

#endif
