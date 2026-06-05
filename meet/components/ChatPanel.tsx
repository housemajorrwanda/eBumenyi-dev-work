'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCallStateHooks, useCall } from '@stream-io/video-react-sdk';
import { X, Send, MessageCircle } from 'lucide-react';
import { useHostSettings } from '@/context/HostSettingsContext';
import { useToast } from './ui/use-toast';

// Message interface
interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: Date;
    isOwn: boolean;
}

interface ChatPanelProps {
    onClose: () => void;
    isMobile?: boolean;
    messages: ChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const ChatPanel = ({ onClose, isMobile = false, messages, setMessages }: ChatPanelProps) => {
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { useLocalParticipant } = useCallStateHooks();
    const call = useCall();
    const { permissionSettings } = useHostSettings();
    const { toast } = useToast();

    const localParticipant = useLocalParticipant();
    const isHost = React.useMemo(() => {
        if (!call || !localParticipant) return false;
        return call.state.createdBy?.id === localParticipant.userId;
    }, [call, localParticipant]);

    // Scroll to bottom when new messages arrive
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Send message
    const sendMessage = async () => {
        if (!newMessage.trim() || !call || !localParticipant) return;

        // Check if chat is allowed
        if (!permissionSettings.allowChat && !isHost) {
            toast({
                title: 'Chat Disabled',
                description: 'The host has disabled chat for this meeting',
                variant: 'destructive',
            });
            setNewMessage('');
            return;
        }

        const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date();
        const messageText = newMessage.trim();

        // Add message locally immediately
        const ownMessage: ChatMessage = {
            id: messageId,
            senderId: localParticipant.userId,
            senderName: localParticipant.name || 'You',
            text: messageText,
            timestamp,
            isOwn: true,
        };

        setMessages((prev) => [...prev, ownMessage]);
        setNewMessage('');

        // Send to all participants via custom event
        try {
            await call.sendCustomEvent({
                type: 'chat-message',
                message: messageText,
                senderId: localParticipant.userId,
                senderName: localParticipant.name || 'You',
                timestamp: timestamp.toISOString(),
                messageId,
            });
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };

    // Handle key down (Enter to send)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Format timestamp
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Get initials from name
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    // Generate consistent avatar color based on name
    const getAvatarColor = (name: string) => {
        const colors = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
        ];
        const index = name.charCodeAt(0) % colors.length;
        return colors[index];
    };

    // Parse message text and convert URLs to clickable links
    const parseMessageWithLinks = (text: string) => {
        // URL regex pattern - matches http, https, and www URLs
        const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
        const parts = text.split(urlPattern);

        return parts.map((part, index) => {
            if (!part) return null;

            // Check if this part is a URL
            if (part.match(urlPattern)) {
                // Add https:// if the URL starts with www.
                const href = part.startsWith('www.') ? `https://${part}` : part;
                return (
                    <a
                        key={index}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="chat-message__link"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {part}
                    </a>
                );
            }

            return <span key={index}>{part}</span>;
        });
    };

    return (
        <div className={`chat-panel ${isMobile ? 'chat-panel--mobile' : ''}`}>
            {/* Header */}
            <div className="chat-panel__header">
                <div className="chat-panel__header-title">
                    <MessageCircle size={20} className="text-white/70" />
                    <h3>In-call messages</h3>
                </div>
                <button
                    onClick={onClose}
                    className="chat-panel__close-btn"
                    aria-label="Close chat"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Info banner */}
            <div className="chat-panel__info">
                <p>Messages can only be seen by people in the call and are deleted when the call ends.</p>
            </div>

            {/* Messages container */}
            <div className="chat-panel__messages">
                {messages.length === 0 ? (
                    <div className="chat-panel__empty">
                        <MessageCircle size={48} className="text-white/20" />
                        <p>No messages yet</p>
                        <span>Send a message to everyone in the call</span>
                    </div>
                ) : (
                    messages.map((message, index) => {
                        const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId;

                        return (
                            <div
                                key={message.id}
                                className={`chat-message ${message.isOwn ? 'chat-message--own' : ''} ${showAvatar ? 'chat-message--with-avatar' : ''}`}
                            >
                                {showAvatar && !message.isOwn && (
                                    <div
                                        className="chat-message__avatar"
                                        style={{ background: getAvatarColor(message.senderName) }}
                                    >
                                        {getInitials(message.senderName)}
                                    </div>
                                )}
                                <div className="chat-message__content">
                                    {showAvatar && (
                                        <div className="chat-message__header">
                                            <span className="chat-message__sender">{message.isOwn ? 'You' : message.senderName}</span>
                                            <span className="chat-message__time">{formatTime(message.timestamp)}</span>
                                        </div>
                                    )}
                                    <div className="chat-message__bubble">
                                        <p>{parseMessageWithLinks(message.text)}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            {!permissionSettings.allowChat && !isHost ? (
                <div className="chat-panel__input-area">
                    <div className="chat-panel__input-container px-4 py-3 bg-dark-3/30 border border-red-500/20 rounded-lg">
                        <div className="text-center text-sm text-red-400 font-medium">
                            Chat has been disabled by the host
                        </div>
                    </div>
                </div>
            ) : (
                <div className="chat-panel__input-area">
                    <div className="chat-panel__input-container">
                        <input
                            ref={inputRef}
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Send a message to everyone"
                            className="chat-panel__input"
                            maxLength={500}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!newMessage.trim()}
                            className="chat-panel__send-btn"
                            aria-label="Send message"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatPanel;
