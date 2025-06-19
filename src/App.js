import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithPopup, signInWithRedirect, GoogleAuthProvider, OAuthProvider, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, onSnapshot, query, where, getDocs, runTransaction } from 'firebase/firestore';
import { ArrowLeft, Plus, Trash2, Share2, Check, Users, Star, Frown, Award, X, Zap, Crown, LogOut, User, ChevronDown, ArrowRight } from 'lucide-react';

// --- Firebase Configuration ---
const localFirebaseConfig = {
  apiKey: "AIzaSyDZZPUyhR551iIZZhtVaBjVOoijWqb6F_4",
  authDomain: "clarity-polls.firebaseapp.com",
  projectId: "clarity-polls",
  storageBucket: "clarity-polls.appspot.com",
  messagingSenderId: "403675966419",
  appId: "1:403675966419:web:a39f0245cef94cb34b5d26",
  measurementId: "G-NYY535SSGM"
};

const firebaseConfig = typeof window.__firebase_config !== 'undefined' ? JSON.parse(window.__firebase_config) : localFirebaseConfig;
const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'clarity-app-local';


// --- 1. UTILITY & HELPER COMPONENTS (Defined First) ---

const LoadingScreen = ({ message }) => (
    <div className="flex flex-col items-center justify-center min-h-screen text-slate-300">
        <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="mt-4 text-lg tracking-widest font-light">{message}</p>
    </div>
);

const GlassCard = ({ children, className = '' }) => (
    <div className={`bg-black/40 backdrop-blur-2xl p-6 md:p-8 rounded-2xl shadow-2xl border border-white/10 ${className}`} style={{'--tw-shadow-color': 'rgba(192, 132, 252, 0.1)', boxShadow: '0 0 60px var(--tw-shadow-color)'}}>
        {children}
    </div>
);

const ErrorScreen = ({ message, navigate }) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-pink-300 p-4 text-center">
        <Frown size={64} className="mb-4 text-pink-500" />
        <h1 className="text-3xl font-bold text-white font-brand">Oops! Something went wrong.</h1>
        <p className="mt-2 text-lg">{message}</p>
        <button onClick={() => navigate('home')} className="mt-8 bg-pink-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-pink-700 transition-colors">
            Go to Homepage
        </button>
    </div>
);


const ParticleBackground = () => {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let particles = [];
        const particleCount = 200;
        const resizeCanvas = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        class Particle {
            constructor() { this.x = Math.random() * canvas.width; this.y = Math.random() * canvas.height; this.size = Math.random() * 2 + 0.5; this.speedX = (Math.random() - 0.5) * 0.15; this.speedY = (Math.random() - 0.5) * 0.15; const colors = ['#ffffff', '#add8e6', '#87ceeb', '#ffd700']; this.color = colors[Math.floor(Math.random() * colors.length)]; this.opacity = Math.random() * 0.7 + 0.1; }
            update() { this.x += this.speedX; this.y += this.speedY; if (this.x < 0) this.x = canvas.width; if (this.x > canvas.width) this.x = 0; if (this.y < 0) this.y = canvas.height; if (this.y > canvas.height) this.y = 0; }
            draw() { ctx.save(); ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.globalAlpha = this.opacity; if (this.color === '#ffd700') { ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(255, 215, 0, 0.5)'; } else { ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(255, 255, 255, 0.25)'; } ctx.fill(); ctx.restore(); }
        }
        const init = () => { particles = []; for (let i = 0; i < particleCount; i++) { particles.push(new Particle()); } };
        const animate = () => { if(!canvas) return; ctx.clearRect(0, 0, canvas.width, canvas.height); for (let i = 0; i < particles.length; i++) { particles[i].update(); particles[i].draw(); } animationFrameId = requestAnimationFrame(animate); };
        resizeCanvas(); init(); animate();
        const handleResize = () => { resizeCanvas(); init(); }
        window.addEventListener('resize', handleResize);
        return () => { window.cancelAnimationFrame(animationFrameId); window.removeEventListener('resize', handleResize); };
    }, []);
    return <canvas ref={canvasRef} className="w-full h-full"></canvas>;
};

const Background = () => (
    <div className="fixed top-0 left-0 w-full h-full -z-10 bg-slate-900">
        <div className="absolute inset-0">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-cyan-400 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-pink-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
        <div className="absolute inset-0"><ParticleBackground /></div>
    </div>
);

const LoginModal = ({ auth, onClose }) => {
    const handleSignIn = async (provider) => {
        try {
            // FIX: Switched to signInWithPopup for reliability.
            await signInWithPopup(auth, provider);
            // After a successful popup login, the onAuthStateChanged listener
            // in the main App component will update the user state.
            // We can now close the modal.
            onClose();
        } catch (error) {
            // This catches errors, including when the user closes the popup manually.
            if (error.code !== 'auth/popup-closed-by-user') {
               console.error("Sign-in error:", error.code, error.message);
            }
        }
    };
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <GlassCard className="w-full max-w-sm text-center relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24}/></button>
                <h1 className="text-4xl font-bold text-white mb-2 font-brand">Welcome to Clarity</h1>
                <p className="text-slate-300 mb-8">Sign in to start making better decisions.</p>
                <div className="space-y-4">
                    <button onClick={() => handleSignIn(new GoogleAuthProvider())} className="w-full flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-4 rounded-lg transition-colors"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6"/>Sign in with Google</button>
                    <button onClick={() => handleSignIn(new OAuthProvider('apple.com'))} className="w-full flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-4 rounded-lg transition-colors"><svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M14.21,3.43C14.43,3.43 14.65,3.43 14.86,3.43C15.75,3.43 16.65,3.43 17.54,3.43C18.66,3.44 19.5,3.84 20.22,4.66C20.96,5.49 21.36,6.47 21.37,7.56C21.37,8.42 21.37,9.28 21.37,10.14C21.37,10.36 21.37,10.58 21.37,10.8C21.14,10.8 20.91,10.8 20.68,10.8C19.79,10.8 18.89,10.8 18,10.8C17.63,10.8 17.26,10.8 16.89,10.81C16.89,11.05 16.89,11.28 16.89,11.51C16.89,12.44 16.89,13.38 16.89,14.31C16.89,14.67 16.89,15.03 16.89,15.39C18.01,15.4 19.12,15.4 20.24,15.39C20.5,15.39 20.75,15.39 21,15.39C21.03,15.65 21.06,15.92 21.1,16.18C20.73,17.25 20,18.23 18.96,18.89C18.2,19.34 17.35,19.55 16.48,19.57C15.68,19.57 14.88,19.57 14.07,19.57C13.84,19.57 13.6,19.57 13.37,19.57C13.37,18.44 13.37,17.31 13.37,16.18C13.37,15.82 13.37,15.46 13.37,15.1C12.25,15.09 11.13,15.09 10.01,15.1C9.65,15.1 9.29,15.1 8.93,15.1C8.93,16.23 8.93,17.36 8.93,18.49C8.93,18.85 8.93,19.22 8.93,19.58C8.7,19.58 8.47,19.58 8.24,19.58C7.43,19.58 6.62,19.58 5.81,19.58C4.94,19.56 4.1,19.35 3.33,18.9C2.26,18.24 1.54,17.27 1.15,16.18C1.12,15.91 1.08,15.64 1.05,15.38C2.17,15.37 3.28,15.37 4.4,15.38C4.77,15.38 5.14,15.38 5.5,15.38C5.5,14.25 5.5,13.12 5.5,11.99C5.5,11.62 5.5,11.25 5.5,10.89C6.63,10.88 7.75,10.88 8.87,10.89C9.23,10.89 9.6,10.89 9.96,10.89C9.96,9.76 9.96,8.63 9.96,7.5C9.96,7.14 9.96,6.77 9.96,6.41C11.09,6.4 12.22,6.4 13.34,6.41C13.34,5.28 13.34,4.15 13.34,3.02C13.34,2.65 13.34,2.29 13.34,1.92L14.47,1.92C14.47,2.42 14.47,2.92 14.47,3.43L14.21,3.43Z"/></svg>Sign in with Apple</button>
                </div>
             </GlassCard>
        </div>
    );
};

const AnimatedResultsDemo = () => {
    const scores = useMemo(() => [
        { id: 'opt_1', name: 'Sushi Samba', score: 32 },
        { id: 'opt_2', name: 'The Italian Place', score: 25 },
        { id: 'opt_3', name: 'Vegan Burger Joint', score: 18 },
    ], []);
    const maxScore = scores[0].score;
    const barGradients = [
        'from-green-400 to-cyan-400',
        'from-blue-400 to-purple-500',
        'from-purple-500 to-pink-500'
    ];
    const glowEffects = [
        '0 0 10px #2dd4bf',
        '0 0 10px #a78bfa',
        '0 0 10px #f472b6'
    ];
    return (
        <GlassCard>
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-white font-brand">Results</h2><div className="flex items-center gap-2 text-slate-400 bg-white/10 px-3 py-1 rounded-full"><Users size={16} /><span className="font-semibold">8</span></div></div>
            <div className="space-y-4">
                {scores.map((option, index) => (
                    <div key={option.id} className="animate-fade-in" style={{animationDelay: `${0.5 + index * 0.2}s`}}>
                        <div className="flex justify-between items-baseline mb-1">
                            <p className="font-semibold text-lg text-white truncate pr-2" title={option.name}>
                                {index === 0 && <Award className="inline-block mr-2 -mt-1 text-yellow-400" size={18} />}
                                <span className="font-bold">{index + 1}.</span> {option.name}
                            </p>
                            <p className="font-bold text-white text-lg">{option.score}</p>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-4">
                            <div className={`rounded-full h-4 transition-all duration-500 ease-out bg-gradient-to-r ${barGradients[index]}`} style={{ width: `${(option.score / maxScore) * 100}%`, animation: `bar-animate 1s ${0.5 + index * 0.2}s ease-out forwards`, transform: 'scaleX(0)', transformOrigin: 'left', boxShadow: glowEffects[index] }}></div>
                        </div>
                    </div>
                ))}
                 <div className="mt-2 text-center text-sm text-cyan-300 font-semibold animate-fade-in relative" style={{animationDelay: '1.2s'}}>22% Clarity</div>
            </div>
             <style>{`@keyframes bar-animate { to { transform: scaleX(1); } }`}</style>
        </GlassCard>
    )
};

const UserMenu = ({ user, auth, navigate, userStatus, onSignIn }) => {
    const [isOpen, setIsOpen] = useState(false);
    const handleSignOut = async () => { await signOut(auth); navigate('home'); };
    if(!user) { return ( <div className="absolute top-6 right-6 z-30"><button onClick={onSignIn} className="bg-white/10 text-white font-semibold py-2 px-4 rounded-full hover:bg-white/20 transition-colors">Sign In</button></div> ) }
    return (
        <div className="absolute top-6 right-6 z-30">
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 bg-white/10 p-2 rounded-full">
                {user.photoURL ? <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full" /> : <User className="w-8 h-8 p-1"/>}
                <span className="font-semibold hidden sm:inline">{user.displayName || 'User'}</span>
                <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-lg shadow-lg py-1">
                     {userStatus && <div className="px-4 py-2 text-xs text-purple-400 uppercase font-bold">{userStatus.tier} Plan</div>}
                     <button onClick={() => {navigate('my-decisions'); setIsOpen(false);}} className="block w-full text-left px-4 py-2 text-slate-300 hover:bg-slate-700">My Decisions</button>
                    {userStatus && userStatus.tier === 'free' && <button onClick={() => {navigate('pricing'); setIsOpen(false);}} className="block w-full text-left px-4 py-2 text-purple-400 hover:bg-slate-700">Upgrade</button>}
                    <button onClick={handleSignOut} className="block w-full text-left px-4 py-2 text-slate-300 hover:bg-slate-700">Sign Out</button>
                </div>
            )}
        </div>
    )
};


const HomePage = ({ navigate, user, auth, userStatus }) => {
    const [showLoginModal, setShowLoginModal] = useState(false);
    const handleMakeDecisionClick = () => { user ? navigate('create') : setShowLoginModal(true); };
    return (
        <>
            {showLoginModal && <LoginModal auth={auth} onClose={() => setShowLoginModal(false)} />}
            <div className="flex flex-col items-center justify-center min-h-screen p-4 overflow-hidden">
                <UserMenu user={user} auth={auth} navigate={navigate} userStatus={userStatus} onSignIn={() => setShowLoginModal(true)} />
                <div className="text-center">
                    <h1 className="text-6xl md:text-8xl font-bold text-white tracking-tighter font-brand animate-fade-in" style={{ textShadow: '0 0 10px rgba(255,255,255,0.2), 0 0 25px rgba(236,72,153,0.3), 0 0 40px rgba(168,85,247,0.3)' }}>Clarity</h1>
                    <p className="mt-3 text-lg md:text-xl text-slate-200 max-w-xl animate-fade-in delay-1" style={{ textShadow: '0 0 8px rgba(0, 0, 0, 0.7)' }}>Make better decisions, together. Turn confusing choices into clear, objective results.</p>
                </div>
                <div className="mt-10 animate-fade-in delay-2">
                    <button onClick={handleMakeDecisionClick} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-10 rounded-full text-lg shadow-[0_5px_15px_rgba(236,72,153,0.4),_inset_0_-2px_5px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_20px_rgba(236,72,153,0.5),_inset_0_-2px_5px_rgba(0,0,0,0.3)] active:shadow-[0_2px_5px_rgba(236,72,153,0.3),_inset_0_-1px_3px_rgba(0,0,0,0.4)] transition-all duration-150 transform hover:-translate-y-1 active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-pink-400 focus:ring-opacity-50">
                        Make a Decision
                    </button>
                </div>
                <div className="mt-24 w-full max-w-6xl mx-auto animate-fade-in delay-3">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-white" style={{ textShadow: '0 0 8px rgba(0, 0, 0, 0.7)' }}>Go Beyond Simple Polls</h2>
                        <p className="text-lg text-slate-300 mt-2 max-w-2xl mx-auto">Find a definitive, data-driven answer that your whole team can feel confident in.</p>
                    </div>
                    <div className="max-w-xl mx-auto"><AnimatedResultsDemo /></div>
                </div>
                <div className="mt-20 text-center text-slate-300 w-full max-w-5xl">
                    <h2 className="text-2xl font-bold text-white mb-6 animate-fade-in" style={{ textShadow: '0 0 8px rgba(0, 0, 0, 0.7)' }}>How It Works</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[ { title: "1. Frame", description: "Ask your question and list the options you're choosing between." }, { title: "2. Define", description: "List the criteria that matter for the decision, like 'Cost' or 'Quality'." }, { title: "3. Rate & Decide", description: "Share a link, have everyone rate the options, and see the best choice emerge." } ].map((step, index) => (
                            <div key={index} className="relative overflow-hidden bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-lg group transition-all duration-300 transform hover:-translate-y-2 animate-fade-in" style={{ animationDelay: `${0.4 + index * 0.1}s` }}>
                                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-in-out"></div>
                                <div className="relative p-6">
                                    <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500 mb-2 font-brand group-hover:text-white group-hover:bg-none transition-colors duration-300" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{step.title}</div>
                                    <p className="text-slate-300 group-hover:text-white transition-colors duration-300">{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

const CreateDecisionPage = ({ db, user, userStatus, setUserStatus, navigate }) => {
    // ...
};

const PricingPage = ({ db, user, navigate, setUserStatus, userStatus }) => {
    //...
};


const DecisionPage = ({ db, user, decisionId, navigate }) => {
    // ...
};

const MyDecisionsPage = ({ db, user, navigate }) => {
    // ...
};

const UpgradeModal = ({ onClose, navigate }) => ( <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"> <GlassCard className="w-full max-w-md text-center"> <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24}/></button> <div className="text-yellow-400 mb-4"><Zap size={48} className="mx-auto"/></div> <h2 className="text-2xl font-bold text-white mb-2 font-brand">Daily Limit Reached</h2> <p className="text-slate-300 mb-6">You've used your free decision for today. Upgrade to Clarity Pro for unlimited decisions and more.</p> <button onClick={() => navigate('pricing')} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 rounded-lg text-lg">Upgrade to Pro</button> </GlassCard> </div> );

const ResultsPanel = ({ decision }) => {
    // ...
};


const VotingInterface = ({ decision, db, userId }) => {
    // ...
};

const StarRating = ({ rating, onRating }) => ( <div className="flex justify-center items-center gap-1">{[1, 2, 3, 4, 5].map((star) => ( <Star key={star} onClick={() => onRating(star)} className={`cursor-pointer transition-all duration-150 ${rating >= star ? 'text-yellow-400 fill-current' : 'text-slate-600'} hover:text-yellow-300 hover:scale-125`} style={{ filter: rating >= star ? 'drop-shadow(0 0 5px #facc15)' : 'none' }} size={24} /> ))}</div> );

const ConfettiExplosion = ({ count = 100 }) => {
    const particles = useMemo(() => {
        return Array.from({ length: count }).map((_, i) => {
            const angle = (i / count) * 360;
            const velocity = 80 + Math.random() * 50;
            const x = Math.cos(angle * (Math.PI / 180)) * velocity;
            const y = Math.sin(angle * (Math.PI / 180)) * velocity;
            const colors = ['#2dd4bf', '#38bdf8', '#a78bfa', '#f472b6'];
            return { color: colors[Math.floor(Math.random() * colors.length)], x, y, rotation: Math.random() * 360, delay: Math.random() * 0.2 };
        });
    }, [count]);
    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            {particles.map((p, i) => ( <div key={i} className="absolute w-2 h-2 particle" style={{ backgroundColor: p.color, '--x-end': `${p.x}px`, '--y-end': `${p.y}px`, transform: `rotate(${p.rotation}deg)`, animation: `confetti-fly 1s ${p.delay}s ease-out forwards` }} ></div> ))}
            <style>{` @keyframes confetti-fly { 0% { transform: translate(0, 0) scale(1); opacity: 1; } 100% { transform: translate(var(--x-end), var(--y-end)) scale(0); opacity: 0; } } `}</style>
        </div>
    );
};


// --- Main App Component ---
export default function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [user, setUser] = useState(null);
    const [userStatus, setUserStatus] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [page, setPage] = useState('home');
    const [decisionId, setDecisionId] = useState(null);

    // --- Firebase Initialization ---
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
                setUser(firebaseUser);
                if (firebaseUser) {
                    const userStatusRef = doc(firestoreDb, `artifacts/${appId}/users/${firebaseUser.uid}/status`, 'main');
                    const userStatusUnsubscribe = onSnapshot(userStatusRef, (docSnap) => {
                         if (docSnap.exists()) {
                            setUserStatus(docSnap.data());
                        } else {
                            const newStatus = { tier: 'free', lastDecisionDate: '', decisionCountToday: 0 };
                            setDoc(userStatusRef, newStatus);
                            setUserStatus(newStatus);
                        }
                    });
                     return () => userStatusUnsubscribe();
                } else {
                    setUserStatus(null);
                }
                setIsAuthReady(true);
            });
            return () => unsubscribe();
        } catch (error) {
            console.error("Error initializing Firebase:", error);
            setIsAuthReady(true);
        }
    }, []);
    
    // --- Routing ---
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.slice(1);
            if (hash.startsWith('decision/')) {
                setDecisionId(hash.split('/')[1]);
                setPage('decision');
            } else if (hash === 'create') {
                if(user) setPage('create'); else window.location.hash = '#';
            } else if (hash === 'pricing') {
                 if(user) setPage('pricing'); else window.location.hash = '#';
            } else if (hash === 'my-decisions') {
                 if(user) setPage('my-decisions'); else window.location.hash = '#';
            } else {
                setPage('home');
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        handleHashChange();
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [user]);

    const navigate = (targetPage, id = null) => {
        if (targetPage === 'decision' && id) window.location.hash = `#decision/${id}`;
        else if (targetPage === 'create') window.location.hash = '#create';
        else if (targetPage === 'pricing') window.location.hash = '#pricing';
        else if (targetPage === 'my-decisions') window.location.hash = '#my-decisions';
        else window.location.hash = '#';
    };

    if (!isAuthReady) {
        return <LoadingScreen message="Initializing Clarity..." />;
    }
    
    // --- Page Rendering ---
    const renderPage = () => {
        switch (page) {
            case 'create': return user && userStatus ? <CreateDecisionPage db={db} user={user} userStatus={userStatus} setUserStatus={setUserStatus} navigate={navigate} /> : <HomePage auth={auth} navigate={navigate} user={user} userStatus={userStatus} />;
            case 'decision': return <DecisionPage db={db} user={user} navigate={navigate} decisionId={decisionId} />;
            case 'pricing': return user && userStatus ? <PricingPage db={db} user={user} navigate={navigate} setUserStatus={setUserStatus} userStatus={userStatus} /> : <HomePage auth={auth} navigate={navigate} user={user} userStatus={userStatus} />;
            case 'my-decisions': return user ? <MyDecisionsPage db={db} user={user} navigate={navigate} /> : <HomePage auth={auth} navigate={navigate} user={user} userStatus={userStatus} />;
            default: return <HomePage auth={auth} navigate={navigate} user={user} userStatus={userStatus} />;
        }
    };

    return (
        <div className="text-slate-200 font-sans">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@700&family=Poppins:wght@400;600&display=swap');
                body { background-color: #020617; }
                .font-brand { font-family: 'Exo 2', sans-serif; }
                .font-body { font-family: 'Poppins', sans-serif; }
                .animate-fade-in { animation: fadeIn 0.7s ease-in-out forwards; opacity: 0; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .delay-1 { animation-delay: 0.1s; } .delay-2 { animation-delay: 0.2s; } .delay-3 { animation-delay: 0.3s; }
                .animate-blob { animation: blob 7s infinite; }
                @keyframes blob { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }
                .animation-delay-2000 { animation-delay: 2s; } .animation-delay-4000 { animation-delay: 4s; }
            `}</style>
            
            <Background />

            <div className="relative z-0 font-body">{renderPage()}</div>
        </div>
    );
}