import {useParams} from "react-router-dom";

function TicketDetails() {

    const { id } = useParams();

    return(
        <div style={{ padding: "30px" }}>
      <h1>Ticket Details</h1>
      <p>Ticket ID: {id}</p>
        </div>
    );
}
export default TicketDetails;
