import { Message as MessageBubble } from "@/components/message";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { db } from "@/config/firebase";
import { Ionicons } from "@expo/vector-icons";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp, writeBatch } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"; // <-- useRef added
import { FlatList, KeyboardAvoidingView, NativeSyntheticEvent, Platform, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import Toast from "react-native-toast-message"; // <-- toast
type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  timestamp: Date | null;
};

// Event type for key in TextInput
type KeyPressEvt = NativeSyntheticEvent<{ key: string }>;

type Props = {
  conversationId?: string;
  employee?: { id: string; employeeName: string };
  hrSenderId?: string;
  hrDisplayName?: string;
};

const DEFAULT_EMPLOYEE = { id: "client", employeeName: "You" };

export default function HomeScreen({ conversationId, employee = DEFAULT_EMPLOYEE, hrDisplayName = "HR" }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  // --- NEW: refs for list + lifecycle tracking
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const initialLoad = useRef(true);
  const lastMessageId = useRef<string | null>(null);

  const convId = useMemo(() => {
    if (conversationId) return conversationId;
    if (!employee) return "";
    return `emp_4jlkqildqtxzgkx9yudz`; // Hardcoded id chat between HR and employee
  }, [conversationId, employee]);

  const ensureConversationDoc = useCallback(async () => {
    if (!convId) return;
    const convRef = doc(db, "conversations", convId);
    await setDoc(
      convRef,
      {
        participantNames: [hrDisplayName, employee?.employeeName ?? ""],
        lastMessageTimestamp: serverTimestamp(),
      },
      { merge: true }
    );
  }, [convId, employee?.employeeName, hrDisplayName]);

  useEffect(() => {
    setMessages([]);
    if (!convId) return;

    ensureConversationDoc().catch(console.error);

    const msgsRef = collection(db, "conversations", convId, "messages");
    const q = query(msgsRef, orderBy("timestamp", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: ChatMessage[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const raw = data.timestamp;
          let ts: Date | null = null;
          if (raw instanceof Timestamp) ts = raw.toDate();
          else if (raw?.toDate) ts = raw.toDate();
          else if (typeof raw === "number") ts = new Date(raw);
          return {
            id: d.id,
            text: data.text ?? "",
            senderId: data.senderId ?? "",
            timestamp: ts,
          };
        });

        setMessages(rows);

        // --- NEW: detect brand-new message after initial load
        const newest = rows[rows.length - 1];
        const prevLast = lastMessageId.current;

        // Always remember the latest ID for the next snapshot
        lastMessageId.current = newest?.id ?? null;

        if (initialLoad.current) {
          // First snapshot -> mark done and scroll to bottom once
          initialLoad.current = false;
          requestAnimationFrame(() => {
            listRef.current?.scrollToEnd({ animated: false });
          });
          return;
        }

        // If we have a truly new message (new id)…
        if (newest && newest.id !== prevLast) {
          // Auto-scroll to the bottom
          requestAnimationFrame(() => {
            listRef.current?.scrollToEnd({ animated: true });
          });

          // Show toast only if the message is from HR/other party
          if (newest.senderId !== employee.id) {
            Toast.show({
              type: "info",
              text1: hrDisplayName,
              text2: newest.text || "New message",
              position: "bottom",
              visibilityTime: 2500,
            });
          }
        }
      },
      (err) => {
        console.error("onSnapshot error (RN):", err);
      }
    );

    return () => {
      unsub();
      initialLoad.current = true; // reset for next mount
      lastMessageId.current = null; // reset
    };
  }, [convId, ensureConversationDoc, employee.id, hrDisplayName]);

  const sendMessage = useCallback(async () => {
    const text = newMessage.trim();
    if (!text || !convId || sending) return;
    setSending(true);
    try {
      const convRef = doc(db, "conversations", convId);
      const msgsRef = collection(convRef, "messages");

      const batch = writeBatch(db);
      const msgRef = doc(msgsRef); // auto-id
      const now = serverTimestamp();

      batch.set(msgRef, {
        senderId: employee.id, // the employee is the sender on mobile
        text,
        timestamp: now,
      });

      batch.set(
        convRef,
        {
          participantNames: [hrDisplayName, employee.employeeName],
          lastMessage: text,
          lastMessageTimestamp: now,
        },
        { merge: true }
      );

      await batch.commit();
      setNewMessage("");

      // --- NEW: scroll after sending (UI feels snappier)
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    } catch (e) {
      console.error("Error sending message (RN):", e);
    } finally {
      setSending(false);
    }
  }, [convId, employee?.id, employee?.employeeName, hrDisplayName, newMessage, sending]);

  const renderItem = ({ item }: { item: ChatMessage }) => (
    <MessageBubble text={item.text} isSender={item.senderId === employee.id} timestamp={item.timestamp ?? new Date()} />
  );
  function handleKeyPress(e: KeyPressEvt) {
    if (e.nativeEvent.key === "Enter") {
      e.preventDefault?.(); // preventDefault is not always needed in RN
      sendMessage();
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
      {/* Header */}
      <ThemedView style={styles.header}>
        <ThemedText type="title">Chat with HR</ThemedText>
      </ThemedView>

      <FlatList
        ref={listRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        initialNumToRender={20}
        removeClippedSubviews
      />

      <ThemedView style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor="#666"
          multiline
          onKeyPress={handleKeyPress}
          editable={!sending}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={sending || newMessage.trim() === ""}>
          <Ionicons name="send" size={24} color={sending || newMessage.trim() === "" ? "#666" : "#007AFF"} />
        </TouchableOpacity>
      </ThemedView>

      {/* Toast */}
      <Toast />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
    gap: 4,
    paddingTop: 40,
    paddingBottom: 40,
  },
  messageList: { flex: 1 },
  messageListContent: { padding: 16 },
  inputContainer: {
    flexDirection: "row",
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: { marginLeft: 8, padding: 8 },
});
