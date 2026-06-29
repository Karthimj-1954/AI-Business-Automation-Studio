import logging
from datetime import datetime
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.models import Workflow, WorkflowExecution, Document
from app.services.generator_service import generator_service

logger = logging.getLogger("app.workflows")

class WorkflowService:
    async def run_execution(
        self,
        workflow_id: UUID,
        user_id: UUID,
        input_data: dict,
        db: Session
    ) -> WorkflowExecution:
        """
        Executes workflow steps sequentially, calling the prompt generators
        and logging outputs directly to the WorkflowExecution table.
        """
        # 1. Load workflow
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id, Workflow.user_id == user_id).first()
        if not workflow:
            raise ValueError("Workflow not found")

        # 2. Initialize execution
        execution = WorkflowExecution(
            workflow_id=workflow_id,
            status="running",
            input_data=input_data or {},
            output_data={},
            started_at=datetime.utcnow()
        )
        db.add(execution)
        db.commit()
        db.refresh(execution)

        output_logs = {}
        last_step_text = ""

        try:
            steps = workflow.steps or []
            for idx, step in enumerate(steps):
                step_id = step.get("id", f"step_{idx}")
                step_type = step.get("type")
                
                logger.info(f"Executing step: {step_id} of type: {step_type}")
                step_output = {}

                if step_type == "trigger":
                    step_output = {"status": "triggered", "message": "Manual trigger initialized"}
                    
                elif step_type == "summarize":
                    # Retrieve document ID either from step configuration or runtime inputs
                    doc_id_str = step.get("document_id") or input_data.get("document_id")
                    if not doc_id_str:
                        raise ValueError(f"Missing document_id context for step {step_id}")
                        
                    doc_id = UUID(doc_id_str)
                    doc = db.query(Document).filter(Document.id == doc_id, Document.user_id == user_id).first()
                    if not doc:
                        raise ValueError(f"Document {doc_id} not found for step {step_id}")
                        
                    doc_text = doc.meta.get("parsed_text", "")
                    if not doc_text:
                        raise ValueError(f"Parsed text is empty for document {doc_id}")
                        
                    length = step.get("target_length", "medium")
                    summary = await generator_service.generate_summary(doc.name, doc_text, length)
                    
                    step_output = {"summary": summary}
                    last_step_text = summary
                    
                elif step_type == "email":
                    recipient = step.get("recipient") or input_data.get("recipient", "Client")
                    tone = step.get("tone", "professional")
                    
                    # Key points can be static, passed in, or chained from previous summary step!
                    key_points = step.get("key_points") or input_data.get("key_points")
                    if not key_points and last_step_text:
                        # Chain previous step output text as context/key points
                        key_points = last_step_text[:1000]
                    elif not key_points:
                        key_points = "Follow up regarding outstanding operational sync metrics."
                        
                    email_body = await generator_service.generate_email(
                        recipient=recipient,
                        tone=tone,
                        key_points=key_points
                    )
                    step_output = {"email": email_body}
                    last_step_text = email_body
                    
                else:
                    logger.warning(f"Unknown step type: {step_type} encountered. Skipping.")
                    step_output = {"status": "skipped", "message": f"Unsupported type: {step_type}"}

                output_logs[step_id] = step_output

            # Mark complete
            execution.status = "completed"
            execution.output_data = output_logs
            execution.completed_at = datetime.utcnow()
            db.commit()
            logger.info(f"Workflow execution {execution.id} completed successfully.")
            
        except Exception as e:
            logger.error(f"Workflow execution {execution.id} failed: {e}")
            execution.status = "failed"
            execution.error_message = str(e)
            execution.output_data = output_logs
            execution.completed_at = datetime.utcnow()
            db.commit()

        return execution

workflow_service = WorkflowService()
