import { useState, useEffect, useRef } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { T } from "../theme.js";
import { fmtDate, initials } from "../utils.js";
import { Avatar } from "../components/atoms.jsx";

export function MessagesRoute({user}) {
  const navigate=useNavigate();
  const location=useLocation();
  const [convs,setConvs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [activeId,setActiveId]=useState(location.state?.activeConvId||null);
  const [msgs,setMsgs]=useState([]);
  const [msgsLoading,setMsgsLoading]=useState(false);
  const [replyText,setReplyText]=useState("");
  const [sending,setSending]=useState(false);
  const [isMobile,setIsMobile]=useState(window.innerWidth<768);
  const bottomRef=useRef(null);

  const isJudge=user?.role==="judge"&&!!user?.judgeId;

  useEffect(()=>{
    const h=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",h);
    return()=>window.removeEventListener("resize",h);
  },[]);

  // Real-time conversation list
  useEffect(()=>{
    if(!user) return;
    let unsub;
    (async()=>{
      try {
        const {db}=await import("../firebase.js");
        const {collection,query,where,onSnapshot}=await import("firebase/firestore");
        const q=isJudge
          ? query(collection(db,"conversations"),where("judgeId","==",user.judgeId))
          : query(collection(db,"conversations"),where("senderUid","==",user.uid));
        unsub=onSnapshot(q,snap=>{
          setConvs(snap.docs.map(d=>({id:d.id,...d.data()}))
            .sort((a,b)=>(b.lastMessageAt||"").localeCompare(a.lastMessageAt||"")));
          setLoading(false);
        },e=>{console.error(e);setLoading(false);});
      } catch(e){console.error(e);setLoading(false);}
    })();
    return()=>{if(unsub)unsub();};
  },[user]);

  // Real-time messages for active conversation
  useEffect(()=>{
    if(!activeId){setMsgs([]);return;}
    setMsgsLoading(true); setMsgs([]);
    let unsub;
    (async()=>{
      try {
        const {db}=await import("../firebase.js");
        const {collection,query,orderBy,onSnapshot}=await import("firebase/firestore");
        unsub=onSnapshot(
          query(collection(db,"conversations",activeId,"messages"),orderBy("sentAt","asc")),
          snap=>{setMsgs(snap.docs.map(d=>({id:d.id,...d.data()})));setMsgsLoading(false);},
          e=>{console.error(e);setMsgsLoading(false);}
        );
      } catch(e){console.error(e);setMsgsLoading(false);}
    })();
    return()=>{if(unsub)unsub();};
  },[activeId]);

  // Mark as read on open
  useEffect(()=>{
    if(!activeId||!user) return;
    const conv=convs.find(c=>c.id===activeId);
    if(!conv) return;
    const field=isJudge?"unreadForJudge":"unreadForSender";
    if(!conv[field]) return;
    (async()=>{
      try {
        const {db}=await import("../firebase.js");
        const {doc,updateDoc}=await import("firebase/firestore");
        await updateDoc(doc(db,"conversations",activeId),{[field]:0});
      } catch(e){}
    })();
  },[activeId,convs]);

  // Scroll to bottom on new messages
  useEffect(()=>{
    if(msgs.length) bottomRef.current?.scrollIntoView({behavior:"smooth"});
  },[msgs]);

  const send=async()=>{
    if(!replyText.trim()||!activeId||sending) return;
    const text=replyText.trim();
    setReplyText("");
    setSending(true);
    try {
      const {db}=await import("../firebase.js");
      const {doc,updateDoc,collection,addDoc}=await import("firebase/firestore");
      const now=new Date().toISOString();
      const side=isJudge?"judge":"sender";
      const otherField=isJudge?"unreadForSender":"unreadForJudge";
      const conv=convs.find(c=>c.id===activeId);
      await addDoc(collection(db,"conversations",activeId,"messages"),{
        from:side, fromName:user.name, fromUid:user.uid, text, sentAt:now,
      });
      await updateDoc(doc(db,"conversations",activeId),{
        lastMessage:text, lastMessageAt:now, lastMessageBy:side,
        [otherField]:(conv?.[otherField]||0)+1,
      });
    } catch(e){console.error(e);setReplyText(text);}
    setSending(false);
  };

  if(!user) return <Navigate to="/"/>;

  const activeConv=convs.find(c=>c.id===activeId);
  const myUnread=c=>isJudge?(c.unreadForJudge||0):(c.unreadForSender||0);
  const otherName=c=>isJudge?c.senderName:c.judgeName;
  const otherPhoto=c=>isJudge?(c.senderPhoto||null):null;
  const showList=!isMobile||!activeId;
  const showThread=!isMobile||!!activeId;

  return (
    <div style={{height:"calc(100vh - 64px)",display:"flex",flexDirection:"column",background:T.bg}}>
      {/* Header */}
      <div style={{background:T.bg,borderBottom:`1px solid ${T.border}`,padding:"0 20px",display:"flex",alignItems:"center",gap:8,height:52,flexShrink:0}}>
        {isMobile&&activeId?(
          <button onClick={()=>setActiveId(null)}
            style={{background:"none",border:"none",cursor:"pointer",color:T.textSub,fontSize:14,fontWeight:500,padding:"6px 10px",borderRadius:100,fontFamily:"inherit"}}>
            ← Back
          </button>
        ):(
          <button onClick={()=>navigate(-1)}
            style={{background:"none",border:"none",cursor:"pointer",color:T.textSub,fontSize:14,fontWeight:500,padding:"6px 10px",borderRadius:100,fontFamily:"inherit"}}>
            ← Back
          </button>
        )}
        <span style={{fontSize:15,fontWeight:500,color:T.text}}>
          {isMobile&&activeConv?otherName(activeConv):"Messages"}
        </span>
      </div>

      {/* Body */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {/* Conversation list */}
        {showList&&(
          <div style={{width:isMobile?"100%":300,flexShrink:0,borderRight:isMobile?"none":`1px solid ${T.border}`,overflowY:"auto"}}>
            {loading?(
              <div style={{padding:40,textAlign:"center",color:T.textHint,fontSize:13}}>Loading…</div>
            ):convs.length===0?(
              <div style={{padding:"60px 24px",textAlign:"center"}}>
                <div style={{fontSize:36,marginBottom:12}}>✉</div>
                <p style={{margin:"0 0 6px",fontSize:14,color:T.textSub,fontWeight:500}}>No conversations yet</p>
                <p style={{margin:0,fontSize:13,color:T.textHint}}>
                  {isJudge?"Booking inquiries from verified show organisers will appear here.":"Booking inquiries you send to judges will appear here."}
                </p>
              </div>
            ):convs.map(c=>{
              const unread=myUnread(c);
              const name=otherName(c);
              const photo=otherPhoto(c);
              return (
                <div key={c.id} onClick={()=>setActiveId(c.id)}
                  style={{padding:"14px 16px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,
                    background:activeId===c.id?T.accentLight:"transparent",
                    borderLeft:`3px solid ${activeId===c.id?T.accent:"transparent"}`,
                    transition:"background .15s"}}>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    {photo
                      ?<img src={photo} style={{width:36,height:36,borderRadius:"50%",objectFit:"cover",flexShrink:0}} alt=""/>
                      :<Avatar label={initials(name||"?")} size={36}/>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6,marginBottom:2}}>
                        <span style={{fontWeight:unread>0?600:400,fontSize:14,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5}}>
                          {unread>0&&<span style={{width:7,height:7,borderRadius:"50%",background:T.accent,flexShrink:0,display:"inline-block"}}/>}
                          {name}
                        </span>
                        <span style={{fontSize:11,color:T.textHint,flexShrink:0}}>{fmtDate(c.lastMessageAt)}</span>
                      </div>
                      <p style={{margin:0,fontSize:12,color:T.textSub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {c.lastMessageBy===(isJudge?"judge":"sender")?"You: ":""}{c.lastMessage}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Thread */}
        {showThread&&(
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            {!activeId?(
              <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,color:T.textHint}}>
                <div style={{fontSize:48,opacity:.35}}>💬</div>
                <p style={{margin:0,fontSize:14,color:T.textSub}}>Select a conversation</p>
              </div>
            ):(
              <>
                {/* Thread header */}
                {!isMobile&&activeConv&&(
                  <div style={{padding:"12px 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",alignItems:"center",gap:10}}>
                    {otherPhoto(activeConv)
                      ?<img src={otherPhoto(activeConv)} style={{width:30,height:30,borderRadius:"50%",objectFit:"cover"}} alt=""/>
                      :<Avatar label={initials(otherName(activeConv)||"?")} size={30}/>}
                    <span style={{fontSize:15,fontWeight:500,color:T.text}}>{otherName(activeConv)}</span>
                  </div>
                )}
                {/* Messages */}
                <div style={{flex:1,overflowY:"auto",padding:"20px 20px 8px",display:"flex",flexDirection:"column",gap:2}}>
                  {msgsLoading?(
                    <div style={{textAlign:"center",color:T.textHint,fontSize:13,padding:20}}>Loading…</div>
                  ):msgs.map(m=>{
                    const mine=m.fromUid===user.uid;
                    return (
                      <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:mine?"flex-end":"flex-start",marginBottom:8}}>
                        {!mine&&<span style={{fontSize:11,color:T.textHint,marginBottom:3,paddingLeft:2}}>{m.fromName}</span>}
                        <div style={{
                          maxWidth:"70%",padding:"10px 14px",
                          borderRadius:mine?"18px 18px 4px 18px":"18px 18px 18px 4px",
                          background:mine?T.accent:T.surface,
                          color:mine?"#fff":T.text,
                          fontSize:14,lineHeight:1.6,boxShadow:T.shadow,
                        }}>{m.text}</div>
                        <span style={{fontSize:11,color:T.textHint,marginTop:3}}>{fmtDate(m.sentAt)}</span>
                      </div>
                    );
                  })}
                  <div ref={bottomRef}/>
                </div>
                {/* Reply input */}
                <div style={{padding:"10px 16px",borderTop:`1px solid ${T.border}`,display:"flex",gap:8,alignItems:"flex-end",flexShrink:0,background:T.bg}}>
                  <textarea value={replyText} onChange={e=>setReplyText(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
                    placeholder="Type a message… Enter to send, Shift+Enter for new line"
                    rows={2}
                    style={{flex:1,padding:"10px 14px",border:`1.5px solid ${T.border}`,borderRadius:T.r,fontSize:14,fontFamily:"inherit",resize:"none",outline:"none",color:T.text,background:T.bg,lineHeight:1.5}}
                    onFocus={e=>e.target.style.borderColor=T.accent}
                    onBlur={e=>e.target.style.borderColor=T.border}/>
                  <button onClick={send} disabled={sending||!replyText.trim()}
                    style={{padding:"10px 18px",borderRadius:100,background:T.accent,color:"#fff",border:"none",
                      cursor:sending||!replyText.trim()?"not-allowed":"pointer",
                      fontSize:14,fontWeight:500,fontFamily:"inherit",
                      opacity:sending||!replyText.trim()?0.5:1,flexShrink:0,transition:"opacity .15s"}}>
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
