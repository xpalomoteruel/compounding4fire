import { courses, socialProfiles } from './data/site.js';

function CourseGraphic({ business }) {
  return <svg viewBox="0 0 480 220" fill="none" aria-hidden="true">
    <circle cx="355" cy="100" r="120" stroke="currentColor" opacity=".12" />
    <circle cx="355" cy="100" r="88" stroke="currentColor" opacity=".12" />
    {business ? <><rect x="175" y="47" width="128" height="138" rx="8" stroke="currentColor" strokeWidth="2" /><path d="M198 74h37m-37 18h75M198 162v-30m26 30v-47m26 47v-23m26 23V99" stroke="currentColor" strokeWidth="7" strokeLinecap="round" /><circle cx="305" cy="156" r="29" fill="#dce8c7" stroke="currentColor" strokeWidth="2" /><path d="m325 178 23 23" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /></> : <><path d="M122 171h232M147 170v-26h36v26m23 0v-55h36v55m23 0V80h36v90" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="m143 113 62-33 50 8 73-51m-24 0h24v24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx="340" cy="139" r="26" fill="#b8e578" /><path d="m330 140 7 7 13-16" stroke="#123d31" strokeWidth="3" strokeLinecap="round" /></>}
  </svg>;
}
export function CoursesPage() {
  return <section className="container explore-page"><header className="explore-heading"><h1>Cursos</h1><p>Dos caminos para profundizar en tus finanzas.</p></header><div className="course-grid">{courses.map((course, i) => <article className={`course-card course-${i}`} key={course.id}><div className="course-art"><span>{String(i + 1).padStart(2, '0')} / CURSO</span><CourseGraphic business={i === 1} /></div><div className="course-content"><div className="course-meta"><span>{course.level}</span><span className="coming-soon">En preparación</span></div><h2>{course.title}</h2><p>{course.description}</p><ul className="course-themes">{course.themes.map(theme => <li key={theme}>{theme}</li>)}</ul></div></article>)}</div></section>;
}
function SocialIcon({ network }) {
  return <svg width="29" height="29" viewBox="0 0 24 24" fill="none" aria-hidden="true">{network === 'instagram' ? <><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></> : <path d="M4 3h4.5L20 21h-4.5L4 3Zm15 0L5 21" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />}</svg>;
}
export function SocialPage() {
  return <section className="container explore-page"><header className="explore-heading"><h1>Redes</h1><p>Compounding4FIRE, también en redes.</p></header><div className="social-grid">{socialProfiles.map(profile => <article className="social-card" key={profile.id}><div className="social-symbol"><SocialIcon network={profile.id} /></div><h2>{profile.name}</h2><p>{profile.url ? 'Sigue las novedades de Compounding4FIRE.' : 'Próximamente'}</p>{profile.url ? <a className="social-follow" href={profile.url} target="_blank" rel="noopener noreferrer">{profile.action}<span aria-hidden="true">↗</span></a> : <button className="social-follow" disabled>{profile.action}<span aria-hidden="true">↗</span></button>}</article>)}</div></section>;
}
