// Styles
import './PostEditor.css';
import 'react-quill/dist/quill.snow.css';

import ReactQuill from 'react-quill';
import DOMPurify from 'dompurify';
import { useHistory } from 'react-router-dom';
import { useRef } from 'react';
import axios from 'axios';

/**
 * This makes a POST request to the server to create a new blog post.
 * This also clears local storage of any drafts.
 * @param {string} title Title of blog post
 * @param {string} content Content of blog post
 * @param {object} history Method of returning to main page after posting
 */
function postNewBlogPost(title, content, history) {
  // make post request
  axios.post('http://localhost:3010/v1/blogposts', {title: title, content: content}, {withCredentials: true})
  .then((response) => {
    // clear local storage of previous data
    cleanUpDraftData();
    // return to main home page
    history.push('/');
  })
  .catch((error) => {
    console.error(error);
  });
}

export default function PostEditor(props) {
  // reference for title
  const titleRef = useRef('');
  // reference for editor
  const editorRef = useRef('');
  // react router history
  const history = useHistory();

  // options for react quill toolbar
  const toolbarOptions = [
    ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
    ['blockquote', 'code-block'],
  
    [{ 'header': 1 }, { 'header': 2 }],               // custom button values
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'script': 'sub'}, { 'script': 'super' }],      // superscript/subscript
    [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent
  
    [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
  
    [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
    [{ 'font': [] }],
    [{ 'align': [] }],
  
    ['clean']                                         // remove formatting button
  ];

  // component return function
  return(
    <form>
      <header>
        <h4>New Post</h4>
        <button
          id='submit-button'
          type='submit'
          onClick={ () => {
            // retrieve the unprivileged editor from the ref to retrieve the html
            const editor = editorRef.current.getEditor();
            const unprivilegedEditor = editorRef.current.makeUnprivilegedEditor(editor);
            // retrieve the HTML from the editor and sanitize it
            const sanitizedContent = DOMPurify.sanitize(unprivilegedEditor.getHTML());
            // make the post request
            postNewBlogPost(titleRef.current.value, sanitizedContent, history);
          }}>
            Post
        </button>
      </header>

      <input 
        ref={titleRef}
        type='text'
        placeholder='Post Title'
        // When any change occurs, save it into local storage
        onChange={(event) => localStorage.setItem('draftTitle', event.target.value)}
        defaultValue={localStorage.getItem('draftTitle')}
      />
      <ReactQuill 
        modules={{toolbar: toolbarOptions}} 
        ref={editorRef} 
        // When any change occurs, save it into local storage
        onChange={(event) => localStorage.setItem('draftContent', event)}
        value={localStorage.getItem('draftContent')}
      />
    </form>
  );
}

/**
 * (Helper function)
 * Removes any draft data saved into local storage by the PostEditor.
 */
export function cleanUpDraftData() {
  localStorage.removeItem('draftTitle');
  localStorage.removeItem('draftContent');
}
