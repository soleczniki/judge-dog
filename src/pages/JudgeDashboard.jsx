import { useNavigate } from "react-router-dom";
import { T } from "../theme.js";
import { fmtDate } from "../utils.js";
import { Avatar, Stars, Btn } from "../components/atoms.jsx";

export function JudgeDashboard({user, judge, reviews, unreadMsgCount, onEditProfile, onNavigate}) {
  const navigate = useNavigate();
  const myReviews = reviews.filter(r=>r.judgeId===judge?.id)
    .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
  const overallAvg = judge && myReviews.length
    ? (myReviews.reduce((s,r)=>s+(r.overall||0),0)/myReviews.length).toFixed(1)
    : null;

  const Card = ({children, style:s}) => (
    <div style={{background:T.surface,borderRadius:T.r,padding:"20px 22px",border:`1px solid ${T.border}`,...s}}>
      {children}
    </div>
  );

  const SectionHd = ({children, action}) => (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <span style={{fontSize:11,fontWeight:700,color:T.textHint,textTransform:"uppercase",letterSpacing:1}}>{children}</span>
      {action}
    </div>
  );

  return (
    <div style={{maxWidth:900,margin:"0 auto",padding:"36px 20px"}}>
      {/* Welcome */}
      <div style={{marginBottom:28}}>
        <h1 style={{margin:"0 0 4px",fontSize:28,fontWeight:400,color:T.text,letterSpacing:-0.5}}>
          Welcome back, {user.name.split(" ")[0]}
        </h1>
        <p style={{margin:0,fontSize:14,color:T.textSub}}>Here's your judge.dog overview</p>
      </div>

      <div className="dash-2col">

        {/* Profile card */}
        <Card>
          <SectionHd action={
            <button onClick={onEditProfile}
              style={{fontSize:12,color:T.accent,background:"none",border:"none",cursor:"pointer",fontWeight:500,padding:0,fontFamily:"inherit"}}>
              Edit profile
            </button>
          }>My profile</SectionHd>
          {judge ? (
            <>
              <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:14}}>
                <Avatar label={judge.photo} photoUrl={judge.profilePhoto} size={52}/>
                <div>
                  <div style={{fontSize:16,fontWeight:500,color:T.text,marginBottom:2}}>{judge.name}</div>
                  {judge.headline&&<div style={{fontSize:13,color:T.textSub,fontStyle:"italic"}}>{judge.headline}</div>}
                  {!judge.headline&&<div style={{fontSize:13,color:T.textHint,fontStyle:"italic"}}>No headline yet</div>}
                </div>
              </div>
              <div style={{display:"flex",gap:16,marginBottom:16}}>
                {overallAvg&&<div style={{textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:500,color:T.text}}>{overallAvg}</div>
                  <div style={{fontSize:11,color:T.textHint}}>avg rating</div>
                </div>}
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:500,color:T.text}}>{myReviews.length}</div>
                  <div style={{fontSize:11,color:T.textHint}}>reviews</div>
                </div>
                {judge.galleryPhotos?.length>0&&<div style={{textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:500,color:T.text}}>{judge.galleryPhotos.length}</div>
                  <div style={{fontSize:11,color:T.textHint}}>gallery photos</div>
                </div>}
              </div>
              <Btn small onClick={()=>navigate(`/judge/${judge.slug||judge.id}`)}>View my profile</Btn>
            </>
          ):(
            <p style={{fontSize:13,color:T.textHint,margin:0}}>Profile not found — contact support.</p>
          )}
        </Card>

        {/* Messages card */}
        <Card style={{cursor:"pointer"}} onClick={()=>navigate("/messages")}>
          <SectionHd action={
            <span style={{fontSize:12,color:T.accent,fontWeight:500}}>View all →</span>
          }>Messages</SectionHd>
          {unreadMsgCount>0?(
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <span style={{fontSize:28,fontWeight:300,color:T.accent}}>{unreadMsgCount}</span>
              <span style={{fontSize:13,color:T.textSub}}>unread message{unreadMsgCount!==1?"s":""}</span>
            </div>
          ):(
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <span style={{fontSize:28,fontWeight:300,color:T.textHint}}>0</span>
              <span style={{fontSize:13,color:T.textHint}}>unread messages</span>
            </div>
          )}
          <div style={{fontSize:13,color:T.textSub,lineHeight:1.6}}>
            Verified show organisers can send you booking inquiries through your profile.
          </div>
        </Card>
      </div>

      {/* Recent reviews */}
      {myReviews.length>0&&(
        <Card>
          <SectionHd action={
            <button onClick={()=>navigate(`/judge/${judge?.slug||judge?.id}`)}
              style={{fontSize:12,color:T.accent,background:"none",border:"none",cursor:"pointer",fontWeight:500,padding:0,fontFamily:"inherit"}}>
              See all →
            </button>
          }>Recent reviews</SectionHd>
          {myReviews.map((r,i)=>(
            <div key={r.id} style={{padding:"12px 0",borderTop:i>0?`1px solid ${T.border}`:"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div>
                  <span style={{fontSize:14,fontWeight:500,color:T.text}}>{r.userName}</span>
                  <span style={{fontSize:12,color:T.textHint,marginLeft:10}}>{r.breed} · {r.show}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                  <Stars val={r.overall} size={12}/>
                  <span style={{fontSize:12,color:T.textHint}}>{fmtDate(r.date)}</span>
                </div>
              </div>
              <p style={{margin:0,fontSize:13,color:T.textSub,lineHeight:1.6,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
                {r.text}
              </p>
            </div>
          ))}
        </Card>
      )}

      {myReviews.length===0&&(
        <Card style={{textAlign:"center",padding:"40px 22px"}}>
          <div style={{fontSize:36,marginBottom:12}}>★</div>
          <p style={{margin:"0 0 6px",fontSize:15,color:T.text,fontWeight:500}}>No reviews yet</p>
          <p style={{margin:0,fontSize:13,color:T.textHint}}>Share your profile link so owners and handlers can leave reviews after shows.</p>
        </Card>
      )}
    </div>
  );
}
