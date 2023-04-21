// Examples
import { useContext } from 'react'
import { FeedContext } from '../contexts/feedContext'
import { ExampleCard } from './exampleCard'
/**
 * Examples component
 * @param {*} props – The props for the example component used to pass in callback functions
 * @param {*} props.posthogInstance - The posthog instance
 * @param {*} props.setQuery - Sets the query in the search bar
 * @param {*} props.handleClick - Handles the search button click
 * @returns {JSX.Element} – The examples component
 */
const ExamplesFeed = (props) => {
    const { examples } = useContext(FeedContext)

    return (
        <div className="px-10 text-gray-900 dark:text-white max-w-4xl">
            <p className={'my-2 font-medium'}> Try these: </p>
            <div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {examples.map((example, idx) => (
                        <ExampleCard
                            key={idx}
                            example={example}
                            props={props}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default ExamplesFeed
