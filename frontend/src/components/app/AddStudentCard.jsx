import react, { useState } from "react";
import './AddStudentCard.css';

export default function AddStudentCard() {
    const [StudentName,setStudentName] = useState('');
    const [ProgramType,setProgramType] = useState('');
    const [ProjectTitle,setProjectTitle] = useState('');
    const [StartDate,setStartDate] = useState('');
    const [EndDate,setEndDate] = useState('');
    const [Duration,setDuration] = useState('');
    const [Mentor,setMentor] = useState('');

    const handleSubmit = (e) =>{
        e.preventDefault();
        console.log('form submitted');
    };

    return (
        <div className="form-container">
            <h2>Add Student Program</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Student Name</label>
                    <input
                    type="text"
                    value={StudentName}
                    onChange={(e) =>setStudentName(e.target.value)}
                    placeholder="Enter Student Name"
                    />
                </div>

                <div className="form-group">
                    <label>Program Type</label>
                    <select
                    value={ProgramType}
                    Onchange={(e) =>setProgramType(e.target.value)}
                    >
                      <option value="">Select type</option>
                      <option value="type1">Type 1</option>
                      <option value="type2">Type 2</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Project Title</label>
                    <input
                    type="text"
                    value={ProjectTitle}
                    Onchange={(e) => setProjectTitle(e.target.value)}
                    placeholder="Enter Project Title"
                    />
                </div>

                <div className="form-group">
                    <div className="date-inputs">
                    <label>Start Date</label>
                    <div>
                        <input
                        type="date"
                        value={StartDate}
                        Onchange={(e)=> setStartDate(e.target.value)}
                        placeholder="Start date"
                        />
                    </div>
                    <label>End Date</label>
                    <div>
                        <input
                        type="date"
                        value={EndDate}
                        onChange={(e)=> setEndDate(e.target.value)}
                        placeholder="End Date"
                        />
                    </div>
                    </div>
                </div>

                <div className="form-group">
                    <label>Duration</label>
                    <div>
                        <input
                        type="text"
                        value={Duration}
                        Onchange={(e)=> setDuration(e.target.value)}
                        placeholder="e.g., 6 months"/>
                    </div>
                </div>

                <div className="form-group">
                    <label>Guide</label>
                    <input
                    type="text"
                    value={Mentor}
                    oNchange={(e) => setMentor(e.target.value)}
                    placeholder="Enter Guide Name"
                    />  
                </div>

                <button type="submit" className="submit-btn">+ Add Program</button>

            </form>
        </div>
    )
}



