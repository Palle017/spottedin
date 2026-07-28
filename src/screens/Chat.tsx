import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import TopBar from '../components/TopBar';
import {
  acceptOffer,
  counterOffer,
  declineOffer,
  getListing,
  getOffer,
  getSeller,
  getThread,
  makeOffer,
  sendMessage,
  subscribe,
} from '../data/store';
import type { MsgSender, Offer, Thread } from '../data/types';
import { formatINR } from '../lib/format';
import './Chat.css';

type OfferPrompt = { kind: 'new' } | { kind: 'counter'; offerId: string };

export default function Chat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [thread, setThread] = useState<Thread | undefined>(() => (id ? getThread(id) : undefined));
  const [draft, setDraft] = useState('');
  const [offerPrompt, setOfferPrompt] = useState<OfferPrompt | null>(null);
  const [offerValue, setOfferValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    setThread(getThread(id));
    return subscribe(() => setThread(getThread(id)));
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [thread?.messages.length]);

  if (!thread) {
    return (
      <>
        <TopBar title="Chat" />
        <EmptyState emoji="✉️" title="Chat not found" subtitle="This conversation doesn't exist." />
      </>
    );
  }

  const listing = getListing(thread.listingId);
  const seller = getSeller(thread.peerId);

  function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !thread) return;
    sendMessage(thread.id, trimmed);
    setDraft('');
  }

  function openMakeOffer() {
    if (!listing) return;
    const suggested = Math.round((listing.priceINR * 0.85) / 10) * 10;
    setOfferPrompt({ kind: 'new' });
    setOfferValue(String(suggested));
  }

  function openCounter(offer: Offer) {
    setOfferPrompt({ kind: 'counter', offerId: offer.id });
    setOfferValue(String(offer.counterINR ?? offer.amountINR));
  }

  function closeOfferPrompt() {
    setOfferPrompt(null);
    setOfferValue('');
  }

  function handleOfferSubmit(e: FormEvent) {
    e.preventDefault();
    if (!offerPrompt || !thread) return;
    const amount = Math.round(Number(offerValue));
    if (!Number.isFinite(amount) || amount <= 0) return;

    if (offerPrompt.kind === 'new') {
      if (!listing) return;
      makeOffer(listing.id, thread.id, amount);
    } else {
      counterOffer(offerPrompt.offerId, amount);
    }
    closeOfferPrompt();
  }

  const lastOfferMsgIndex = new Map<string, number>();
  thread.messages.forEach((msg, i) => {
    if (msg.kind === 'offer' && msg.offerId) lastOfferMsgIndex.set(msg.offerId, i);
  });

  return (
    <div className="chat">
      <TopBar title={seller?.name ?? 'Chat'} />

      {listing && (
        <div className="chat__listing-strip">
          <div
            className="chat__listing-thumb"
            style={
              !listing.photoDataUrl
                ? { background: `linear-gradient(135deg, ${listing.gradient[0]}, ${listing.gradient[1]})` }
                : undefined
            }
          >
            {listing.photoDataUrl ? (
              <img src={listing.photoDataUrl} alt="" />
            ) : (
              <span aria-hidden="true">{listing.emoji}</span>
            )}
          </div>
          <div className="chat__listing-info">
            <span className="chat__listing-title">{listing.title}</span>
            <span className="price-tag" style={{ fontSize: 13 }}>{formatINR(listing.priceINR)}</span>
          </div>
        </div>
      )}

      <div className="chat__messages">
        {thread.messages.length === 0 && (
          <EmptyState emoji="👋" title="Say hello" subtitle="Start the conversation about this item." />
        )}
        {thread.messages.map((msg, i) => {
          if (msg.kind === 'offer' && msg.offerId) {
            if (lastOfferMsgIndex.get(msg.offerId) !== i) return null;
            const offer = getOffer(msg.offerId);
            if (!offer) return null;
            return (
              <div key={i} className={`chat__bubble-row chat__bubble-row--${msg.from}`}>
                <OfferCard
                  offer={offer}
                  lastFrom={msg.from}
                  timeAgo={msg.timeAgo}
                  onAccept={() => acceptOffer(offer.id)}
                  onDecline={() => declineOffer(offer.id)}
                  onCounter={() => openCounter(offer)}
                  onBuy={(amount) => navigate(`/checkout/${offer.listingId}?offer=${amount}`)}
                />
              </div>
            );
          }
          return (
            <div key={i} className={`chat__bubble-row chat__bubble-row--${msg.from}`}>
              <div className="chat__bubble">
                {msg.text}
                <span className="chat__bubble-time">{msg.timeAgo}</span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat__quick-actions">
        <button type="button" className="chat__quick-chip" onClick={openMakeOffer}>
          💸 Make offer
        </button>
        <button type="button" className="chat__quick-chip" onClick={() => handleSend('Is this still available?')}>
          Still available?
        </button>
        <button type="button" className="chat__quick-chip" onClick={() => handleSend('Can you do free shipping?')}>
          Free shipping?
        </button>
      </div>

      {offerPrompt && (
        <form className="chat__offer-prompt" onSubmit={handleOfferSubmit}>
          <span className="chat__offer-prompt-label">
            {offerPrompt.kind === 'new' ? 'Your offer' : 'Your counter'}
          </span>
          <span className="chat__offer-prompt-prefix">₹</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            className="chat__offer-prompt-input"
            value={offerValue}
            onChange={(e) => setOfferValue(e.target.value)}
            autoFocus
          />
          <button type="submit" className="chat__offer-prompt-send" disabled={!offerValue.trim()}>
            Send
          </button>
          <button type="button" className="chat__offer-prompt-cancel" onClick={closeOfferPrompt}>
            Cancel
          </button>
        </form>
      )}

      <form
        className="chat__composer"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(draft);
        }}
      >
        <input
          type="text"
          className="chat__composer-input"
          placeholder="Message..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="chat__composer-send" disabled={!draft.trim()} aria-label="Send">
          ➤
        </button>
      </form>
    </div>
  );
}

function offerStatusLabel(status: Offer['status']): string {
  switch (status) {
    case 'pending': return 'Pending';
    case 'accepted': return 'Accepted';
    case 'declined': return 'Declined';
    case 'countered': return 'Countered';
  }
}

function OfferCard({
  offer,
  lastFrom,
  timeAgo,
  onAccept,
  onDecline,
  onCounter,
  onBuy,
}: {
  offer: Offer;
  lastFrom: MsgSender;
  timeAgo: string;
  onAccept: () => void;
  onDecline: () => void;
  onCounter: () => void;
  onBuy: (amount: number) => void;
}) {
  const isIncoming = lastFrom === 'peer';
  const awaitingMe = isIncoming && (offer.status === 'pending' || offer.status === 'countered');
  const amount = offer.status === 'countered' || offer.status === 'accepted'
    ? offer.counterINR ?? offer.amountINR
    : offer.amountINR;

  const label = offer.status === 'countered'
    ? (isIncoming ? 'Seller countered' : 'You countered')
    : offer.status === 'accepted'
      ? 'Offer accepted'
      : offer.status === 'declined'
        ? 'Offer declined'
        : offer.by === 'me' ? 'Your offer' : "Seller's offer";

  return (
    <div className="offer-card">
      <div className="offer-card__head">
        <span className="offer-card__tag">Offer</span>
        <span className={`offer-card__status offer-card__status--${offer.status}`}>
          {offerStatusLabel(offer.status)}
        </span>
      </div>
      <div className="offer-card__amount">{formatINR(amount)}</div>
      <div className="offer-card__label">{label}</div>

      {offer.status === 'accepted' && (
        <button type="button" className="offer-card__buy" onClick={() => onBuy(amount)}>
          Buy at {formatINR(amount)}
        </button>
      )}

      {awaitingMe && (
        <div className="offer-card__actions">
          <button type="button" className="offer-card__accept" onClick={onAccept}>Accept</button>
          <button type="button" className="offer-card__counter" onClick={onCounter}>Counter</button>
          <button type="button" className="offer-card__decline" onClick={onDecline}>Decline</button>
        </div>
      )}

      {!isIncoming && (offer.status === 'pending' || offer.status === 'countered') && (
        <div className="offer-card__waiting">Waiting for seller…</div>
      )}

      <span className="offer-card__time">{timeAgo}</span>
    </div>
  );
}
