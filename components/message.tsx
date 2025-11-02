import { StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';

interface MessageProps {
    text: string;
    isSender: boolean;
    timestamp: Date;
}

export function Message({ text, isSender, timestamp }: MessageProps) {
    return (
        <View style={[styles.messageContainer, isSender ? styles.senderMessage : styles.receiverMessage]}>
            {/* Message */}
            <ThemedText style={[styles.messageText, isSender ? styles.senderText : styles.receiverText]}>
                {text}
            </ThemedText>

            {/* Timestamp */}
            <ThemedText style={[styles.timestamp, isSender ? styles.senderText : styles.receiverText]}>
                {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    messageContainer: {
        maxWidth: '80%',
        marginVertical: 4,
        padding: 12,
        borderRadius: 16,
        flexDirection: 'column',
    },
    senderMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#007AFF',
        borderBottomRightRadius: 4,
    },
    receiverMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#E5E5EA',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
    },
    senderText: {
        color: '#FFFFFF',
    },
    receiverText: {
        color: '#000000',
    },
    timestamp: {
        fontSize: 11,
        marginTop: 4,
        opacity: 0.7,
        alignSelf: 'flex-end',
    },
});
