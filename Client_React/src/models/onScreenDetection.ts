import { RefObject, useEffect, useState } from "react"


export default function useOnScreen(ref: RefObject<HTMLElement>) {

  const [isOnScreen, setISOnScreen] = useState(false)

  // const observer = useMemo(() => new IntersectionObserver(
  //   ([entry]) => setISOnScreen(entry.isIntersecting)
  // ))


  useEffect(() => {
    console.log("observer created")
    const observer = new IntersectionObserver(([entry]) => setISOnScreen(entry.isIntersecting))
    if(ref.current){
      observer.observe(ref.current);
    } 
    return () => observer.disconnect()
  }, [ref])

  return isOnScreen
}//